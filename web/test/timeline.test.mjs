import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { QueryClient } from "@tanstack/react-query";
import ts from "typescript";

const directory = new URL("../.review/tests/timeline/", import.meta.url);
await mkdir(new URL("abi/", directory), { recursive: true });
for (const file of ["timeline", "chain", "agreements", "lib", "abi/rewind"]) {
  const source = await readFile(new URL(`../src/${file}.ts`, import.meta.url), "utf8");
  const result = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } });
  await writeFile(new URL(`${file}.js`, directory), result.outputText);
}
await writeFile(new URL("config.js", directory), 'export const CONTRACT = "0x0000000000000000000000000000000000000011"; export const DEPLOY_BLOCK = 10320988n; export const publicClient = {};\n');
const { CONTRACT, publicClient } = await import(new URL("config.js", directory));
const { readTimeline, timelineInconsistency, parseDeployBlock, DEFAULT_DEPLOY_BLOCK, TIMELINE_CHUNK, TIMELINE_SCAN_LIMIT } = await import(new URL("timeline.js", directory));
const { timelineQueryOptions } = await import(new URL("chain.js", directory));

function event(eventName, blockNumber, logIndex = 0, id = 2n) {
  return { eventName, blockNumber, logIndex, args: { id }, transactionHash: `0x${blockNumber.toString(16).padStart(64, "0")}` };
}
function mock(latest, logs = [], fail = () => false) {
  const calls = [];
  let active = 0;
  let maximum = 0;
  publicClient.getBlockNumber = async () => latest;
  publicClient.getLogs = async (request) => {
    calls.push(request);
    active++;
    maximum = Math.max(active, maximum);
    await Promise.resolve();
    active--;
    if (fail(request, calls)) throw new Error("Offline RPC failure");
    return logs.filter((log) => log.eventName === request.event.name && log.args.id === request.args.id && log.blockNumber >= request.fromBlock && log.blockNumber <= request.toBlock);
  };
  return { calls, maximum: () => maximum };
}

describe("Agreement timeline (offline)", () => {
  it("uses the public Ignition receipt's deployment block and validates configuration without echoing input", async () => {
    const journal = await readFile(new URL("../../contracts/ignition/deployments/chain-9800/journal.jsonl", import.meta.url), "utf8");
    const receipt = journal.trim().split(/\r?\n/).map((line) => JSON.parse(line)).find((entry) => entry.futureId === "RewindModule#Rewind" && entry.type === "TRANSACTION_CONFIRM").receipt;
    assert.equal(DEFAULT_DEPLOY_BLOCK, BigInt(receipt.blockNumber));
    assert.equal(parseDeployBlock(), DEFAULT_DEPLOY_BLOCK);
    assert.equal(parseDeployBlock("0"), 0n);
    assert.equal(parseDeployBlock(" 123 "), 123n);
    assert.equal(parseDeployBlock("unknown"), undefined);
    for (const input of ["", "-1", "1.5", "1e3", "0x10", "invalid-marker"]) {
      assert.throws(() => parseDeployBlock(input), (error) => error.message.includes("VITE_REWIND_DEPLOY_BLOCK") && !error.message.includes(input || "invalid-marker"));
    }
  });

  it("scans deployment through latest in gap-free chunks, filters every request by indexed ID, orders and deduplicates logs", async () => {
    const created = event("AgreementCreated", 10001n, 1);
    const { calls, maximum } = mock(100000n, [event("AgreementReleased", 95000n), event("AgreementFulfilled", 10001n, 2), created, created, event("AgreementRefunded", 99999n, 0, 3n)]);
    const result = await readTimeline(publicClient, CONTRACT, 2n, 10000n);
    assert.deepEqual(result.logs.map(({ eventName }) => eventName), ["AgreementCreated", "AgreementFulfilled", "AgreementReleased"]);
    assert.equal(result.fromBlock, 10000n);
    assert.equal(result.toBlock, 100000n);
    assert.equal(result.scannedBlocks, 90001n);
    assert.equal(result.creationFound, true);
    assert.equal(result.limitReached, false);
    assert.equal(result.deploymentKnown, true);
    assert.equal(maximum(), 4);
    assert.equal(calls.length, 20);
    for (const call of calls) {
      assert.equal(call.address, CONTRACT);
      assert.deepEqual(call.args, { id: 2n });
      assert.equal(call.strict, true);
      assert.ok(call.toBlock - call.fromBlock + 1n <= TIMELINE_CHUNK);
    }
    for (const name of ["AgreementCreated", "AgreementFulfilled", "AgreementReleased", "AgreementRefunded"]) {
      const chunks = calls.filter(({ event }) => event.name === name).sort((a, b) => Number(a.fromBlock - b.fromBlock));
      assert.equal(chunks[0].fromBlock, 10000n);
      assert.equal(chunks.at(-1).toBlock, 100000n);
      for (let index = 1; index < chunks.length; index++) assert.equal(chunks[index].fromBlock, chunks[index - 1].toBlock + 1n);
    }
    assert.equal(timelineInconsistency(result.logs, 3), undefined);
  });

  it("retries individual failing getLogs requests and the latest-block read", async () => {
    let attempts = 0;
    const { calls } = mock(20n, [], (request) => request.event.name === "AgreementCreated" && ++attempts < 3);
    let heads = 0;
    publicClient.getBlockNumber = async () => { if (++heads === 1) throw new Error("Offline head failure"); return 20n; };
    const result = await readTimeline(publicClient, CONTRACT, 2n, 0n);
    assert.equal(heads, 2);
    assert.equal(attempts, 3);
    assert.equal(calls.length, 6);
    assert.deepEqual(result.logs, []);
    assert.equal(result.creationFound, false);
  });

  it("rejects exhausted RPC retries without returning empty or partial history", async () => {
    const { calls } = mock(80000n, [event("AgreementCreated", 1n)], (request) => request.event.name === "AgreementReleased" && request.fromBlock === 40000n);
    await assert.rejects(readTimeline(publicClient, CONTRACT, 2n, 0n), /Offline RPC failure/);
    assert.equal(calls.filter((request) => request.event.name === "AgreementReleased" && request.fromBlock === 40000n).length, 3);
  });

  it("searches backwards when deployment is unknown and stops after the wave containing creation", async () => {
    const { calls } = mock(1000000n, [event("AgreementCreated", 800005n), event("AgreementFulfilled", 950000n)]);
    const result = await readTimeline(publicClient, CONTRACT, 2n, undefined);
    assert.equal(result.creationFound, true);
    assert.equal(result.limitReached, false);
    assert.equal(result.deploymentKnown, false);
    assert.equal(result.fromBlock, 760001n);
    assert.equal(result.scannedBlocks, 240000n);
    assert.deepEqual(result.logs.map(({ eventName }) => eventName), ["AgreementCreated", "AgreementFulfilled"]);
    assert.ok(calls.every(({ fromBlock }) => fromBlock >= 760001n));
  });

  it("stops at exactly 600,000 blocks without creation and reports the scan limit", async () => {
    const { calls, maximum } = mock(1000000n, [event("AgreementReleased", 990000n)]);
    const result = await readTimeline(publicClient, CONTRACT, 2n, undefined);
    assert.equal(result.scannedBlocks, TIMELINE_SCAN_LIMIT);
    assert.equal(result.fromBlock, 400001n);
    assert.equal(result.limitReached, true);
    assert.equal(result.creationFound, false);
    assert.equal(calls.length, 120);
    assert.equal(maximum(), 4);
    assert.ok(calls.every(({ fromBlock }) => fromBlock >= 400001n));
  });

  it("reads beyond 600,000 blocks when the deployment block is known", async () => {
    mock(1000000n, [event("AgreementCreated", 1n), event("AgreementReleased", 999999n)]);
    const result = await readTimeline(publicClient, CONTRACT, 2n, 0n);
    assert.equal(result.fromBlock, 0n);
    assert.equal(result.scannedBlocks, 1000001n);
    assert.equal(result.creationFound, true);
    assert.equal(result.limitReached, false);
    assert.equal(result.logs.length, 2);
  });

  it("handles genesis and single-block deployment boundaries without negative or overlapping ranges", async () => {
    const { calls } = mock(25n);
    const unknown = await readTimeline(publicClient, CONTRACT, 2n, undefined);
    assert.equal(unknown.fromBlock, 0n);
    assert.equal(unknown.scannedBlocks, 26n);
    assert.equal(unknown.limitReached, false);
    assert.ok(calls.every(({ fromBlock }) => fromBlock === 0n));
    mock(25n);
    assert.equal((await readTimeline(publicClient, CONTRACT, 2n, 25n)).scannedBlocks, 1n);
    await assert.rejects(readTimeline(publicClient, CONTRACT, 2n, 26n), /newer than/);
  });

  it("reports empty and mismatched final events against every current contract state", () => {
    for (const [state, name] of [[1, "AgreementCreated"], [2, "AgreementFulfilled"], [3, "AgreementReleased"], [4, "AgreementRefunded"]]) {
      assert.equal(timelineInconsistency([event(name, 1n)], state), undefined);
      assert.match(timelineInconsistency([], state), /Timeline incomplete.*no events/);
    }
    assert.match(timelineInconsistency([event("AgreementFulfilled", 1n)], 3), /inconsistency.*Released.*AgreementFulfilled/);
    assert.match(timelineInconsistency([event("AgreementReleased", 1n)], 4), /inconsistency.*Refunded.*AgreementReleased/);
  });

  it("caches timelines by agreement ID in memory and preserves an error on failed refresh", async () => {
    const cache = new QueryClient();
    const { calls } = mock(DEFAULT_DEPLOY_BLOCK + 10n, [event("AgreementCreated", DEFAULT_DEPLOY_BLOCK + 1n)]);
    try {
      const options = timelineQueryOptions(2n);
      const first = await cache.fetchQuery(options);
      assert.equal(await cache.fetchQuery(options), first);
      assert.equal(calls.length, 4);
      await cache.fetchQuery(timelineQueryOptions(3n));
      assert.equal(calls.length, 8);
      mock(DEFAULT_DEPLOY_BLOCK + 10n, [], () => true);
      await assert.rejects(cache.fetchQuery({ ...options, staleTime: 0 }), /Offline RPC failure/);
      assert.equal(cache.getQueryState(options.queryKey).status, "error");
      assert.equal(cache.getQueryData(options.queryKey), first);
    } finally { cache.clear(); }
  });
});
