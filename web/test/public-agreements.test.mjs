import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import ts from "typescript";

// Exercise the real reader with an offline client, never a live RPC or env files.
const directory = new URL("../.review/tests/public-agreements/", import.meta.url);
await mkdir(new URL("abi/", directory), { recursive: true });
for (const file of ["chain", "abi/rewind"]) {
  const source = await readFile(new URL(`../src/${file}.ts`, import.meta.url), "utf8");
  const result = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } });
  await writeFile(new URL(`${file}.js`, directory), result.outputText);
}
await writeFile(new URL("config.js", directory), 'export const CONTRACT = "0x0000000000000000000000000000000000000011"; export const publicClient = {};\n');
const { publicClient, CONTRACT } = await import(new URL("config.js", directory));
const { readRecentAgreements, recentEvents, RECENT_BLOCKS } = await import(new URL("chain.js", directory));

function created(id, blockNumber, logIndex = 0) {
  return { eventName: "AgreementCreated", args: { id }, blockNumber, logIndex, transactionHash: `0x${blockNumber.toString(16).padStart(64, "0")}` };
}
function setup(events, latest = 25000n) {
  const scans = [];
  const reads = [];
  publicClient.getBlockNumber = async () => latest;
  publicClient.getLogs = async (request) => {
    scans.push(request);
    return events.filter((event) => event.blockNumber >= request.fromBlock && event.blockNumber <= request.toBlock);
  };
  publicClient.readContract = async (request) => {
    reads.push(request);
    return { buyer: CONTRACT, seller: "0x0000000000000000000000000000000000000022", amount: 123n, state: Number(request.args[0] % 4n + 1n) };
  };
  return { scans, reads };
}

describe("Public agreement discovery (offline)", () => {
  it("scans only creation events across the shared bounded range without a wallet", async () => {
    const { scans, reads } = setup([created(1n, 4999n), created(2n, 5000n), created(3n, 25000n)]);
    const result = await readRecentAgreements();
    assert.equal(result.fromBlock, 25000n - RECENT_BLOCKS);
    assert.equal(result.toBlock, 25000n);
    assert.equal(scans.length, 11);
    assert.equal(scans[0].fromBlock, 5000n);
    assert.equal(scans.at(-1).toBlock, 25000n);
    for (const [index, request] of scans.entries()) {
      assert.equal(request.address, CONTRACT);
      assert.equal(request.event.name, "AgreementCreated");
      assert.equal(request.args, undefined);
      assert.ok(request.toBlock - request.fromBlock < 2000n);
      if (index) assert.equal(request.fromBlock, scans[index - 1].toBlock + 1n);
    }
    assert.deepEqual(result.payments.map(({ id }) => id), [3n, 2n]);
    assert.deepEqual(reads.map(({ functionName, args, address }) => ({ functionName, args, address })), [
      { functionName: "getAgreement", args: [3n], address: CONTRACT },
      { functionName: "getAgreement", args: [2n], address: CONTRACT },
    ]);
    assert.equal(result.payments[0].agreement.state, 4);
    assert.equal(result.payments[1].agreement.amount, 123n);
  });

  it("deduplicates logs, orders by block and log index, and reads only the newest five in compact mode", async () => {
    const duplicate = created(7n, 12n, 1);
    const events = [created(1n, 1n), created(6n, 12n), created(3n, 3n), duplicate, created(2n, 2n), created(5n, 5n), created(4n, 4n), duplicate];
    const { reads } = setup(events, 20n);
    const result = await readRecentAgreements(5);
    assert.equal(result.fromBlock, 0n);
    assert.equal(result.logs.length, 7);
    assert.deepEqual(result.payments.map(({ id }) => id), [7n, 6n, 5n, 4n, 3n]);
    assert.equal(reads.length, 5);
  });

  it("returns an empty scan without inventing payments or reading agreements", async () => {
    const { reads } = setup([], 0n);
    assert.deepEqual((await readRecentAgreements()).payments, []);
    assert.equal(reads.length, 0);
  });

  it("propagates log and agreement read failures for the UI error and retry states", async () => {
    setup([]);
    publicClient.getLogs = async () => { throw new Error("offline log failure"); };
    await assert.rejects(readRecentAgreements(), /offline log failure/);
    setup([created(1n, 25000n)]);
    publicClient.readContract = async () => { throw new Error("offline agreement failure"); };
    await assert.rejects(readRecentAgreements(), /offline agreement failure/);
  });

  it("preserves agreement-specific history for the payment details page", async () => {
    setup([created(1n, 25000n), created(2n, 25000n, 1)]);
    assert.deepEqual((await recentEvents(2n)).logs.map(({ args }) => args.id), [2n]);
  });
});
