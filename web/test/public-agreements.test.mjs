import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { ContractFunctionRevertedError, encodeErrorResult } from "viem";
import { QueryClient } from "@tanstack/react-query";
import ts from "typescript";

// Exercise the real readers with an offline client, never a live RPC or env files.
const directory = new URL("../.review/tests/public-agreements/", import.meta.url);
await mkdir(new URL("abi/", directory), { recursive: true });
for (const file of ["agreements", "chain", "lib", "abi/rewind"]) {
  const source = await readFile(new URL(`../src/${file}.ts`, import.meta.url), "utf8");
  const result = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } });
  await writeFile(new URL(`${file}.js`, directory), result.outputText);
}
await writeFile(new URL("config.js", directory), 'export const CONTRACT = "0x0000000000000000000000000000000000000011"; export const publicClient = {};\n');
const { publicClient, CONTRACT } = await import(new URL("config.js", directory));
const { rewindAbi } = await import(new URL("abi/rewind.js", directory));
const { enumerateAgreements, AGREEMENT_CAP, AGREEMENT_BATCH_SIZE, walletAgreements, agreementCoverage } = await import(new URL("agreements.js", directory));
const { agreementsQueryOptions, recentEvents, RECENT_BLOCKS } = await import(new URL("chain.js", directory));
const missingData = encodeErrorResult({ abi: rewindAbi, errorName: "AgreementNotFound" });
const seller = "0x00000000000000000000000000000000000000aB";

function setup(count, failures = new Map(), missing = { cause: { data: missingData } }) {
  const reads = [];
  let active = 0;
  let maximum = 0;
  publicClient.readContract = async (request) => {
    reads.push(request);
    active++;
    maximum = Math.max(maximum, active);
    await Promise.resolve();
    active--;
    const id = request.args[0];
    if (failures.has(id)) throw failures.get(id);
    if (id > BigInt(count)) throw missing;
    return { buyer: CONTRACT, seller, amount: id * 100n, state: Number(id % 4n + 1n), termsHash: `0x${"00".repeat(32)}`, fulfilBy: 1n };
  };
  publicClient.getLogs = async () => { throw new Error("Lists must not read logs"); };
  publicClient.getBlockNumber = async () => { throw new Error("Lists must not read block ranges"); };
  return { reads, maximum: () => maximum };
}

describe("Agreement enumeration (offline)", () => {
  it("reads contiguous IDs in bounded parallel batches, stops on the ABI-decoded missing ID, and returns newest first", async () => {
    const { reads, maximum } = setup(23);
    const result = await enumerateAgreements(publicClient, CONTRACT);
    assert.deepEqual(result.payments.map(({ id }) => id), Array.from({ length: 23 }, (_, index) => BigInt(23 - index)));
    assert.equal(result.lastId, 23n);
    assert.equal(result.capped, false);
    assert.equal(reads.length, 30); // The final in-flight batch ends at ID 30; no later batch starts.
    assert.equal(maximum(), AGREEMENT_BATCH_SIZE);
    assert.deepEqual(reads.map(({ args }) => args[0]), Array.from({ length: 30 }, (_, index) => BigInt(index + 1)));
    for (const request of reads) {
      assert.equal(request.address, CONTRACT);
      assert.equal(request.functionName, "getAgreement");
      assert.equal(request.abi, rewindAbi);
    }
    assert.equal(result.payments[0].agreement.amount, 2300n);
    assert.equal(result.payments[0].agreement.state, 4);
    assert.equal(agreementCoverage(result), "Read directly from the Rewind contract: agreements 1 to 23.");
  });

  it("recognizes viem's decoded revert and treats ID 1 not found as a successful empty contract", async () => {
    const missing = new ContractFunctionRevertedError({ abi: rewindAbi, functionName: "getAgreement", data: missingData });
    const { reads } = setup(0, new Map(), { cause: missing });
    const result = await enumerateAgreements(publicClient, CONTRACT);
    assert.deepEqual(result, { payments: [], lastId: 0n, capped: false });
    assert.equal(reads.length, AGREEMENT_BATCH_SIZE);
    assert.match(agreementCoverage(result), /no agreements found/);
  });

  it("finds the end at a batch boundary without skipping an ID", async () => {
    const { reads } = setup(10);
    const result = await enumerateAgreements(publicClient, CONTRACT);
    assert.equal(result.lastId, 10n);
    assert.equal(result.payments.length, 10);
    assert.equal(reads.length, 20);
  });

  it("never reads beyond the hard cap and reports that more agreements may exist", async () => {
    const { reads } = setup(600);
    const result = await enumerateAgreements(publicClient, CONTRACT);
    assert.equal(reads.length, AGREEMENT_CAP);
    assert.equal(reads.at(-1).args[0], 500n);
    assert.equal(result.lastId, 500n);
    assert.equal(result.payments.length, 500);
    assert.equal(result.capped, true);
    assert.match(agreementCoverage(result), /more agreements may exist/);
  });

  for (const [label, count, failedId] of [["initial", 0, 1n], ["later", 23, 12n], ["after a missing ID in the same batch", 0, 5n]]) {
    it(`rejects an ${label} RPC failure instead of returning an empty or partial list`, async () => {
      const failure = new Error("RPC unavailable (AgreementNotFound in a message is not a decoded revert)");
      setup(count, new Map([[failedId, failure]]));
      await assert.rejects(enumerateAgreements(publicClient, CONTRACT), (error) => error === failure);
    });
  }

  it("propagates other contract reverts and unrecognized revert data", async () => {
    for (const failure of [
      { cause: { data: encodeErrorResult({ abi: rewindAbi, errorName: "OnlyBuyer" }) } },
      { data: "0x12345678" }, { data: { errorName: "AgreementNotFound" } },
    ]) {
      setup(0, new Map([[1n, failure]]));
      await assert.rejects(enumerateAgreements(publicClient, CONTRACT), (error) => error === failure);
    }
  });

  it("filters the same enumeration by buyer or seller without regard to address casing", async () => {
    setup(3);
    const { payments } = await enumerateAgreements(publicClient, CONTRACT);
    const unrelated = { ...payments[0], id: 99n, agreement: { ...payments[0].agreement, buyer: seller, seller } };
    const mixed = [...payments, unrelated];
    assert.deepEqual(walletAgreements(mixed, CONTRACT.toUpperCase()).map(({ id }) => id), [3n, 2n, 1n]);
    assert.deepEqual(walletAgreements(payments, seller.toLowerCase()).map(({ id }) => id), [3n, 2n, 1n]);
    assert.deepEqual(walletAgreements(payments, "0x0000000000000000000000000000000000000099"), []);
  });

  it("shares the successful enumeration in memory and never replaces it with an empty list after an RPC failure", async () => {
    const cache = new QueryClient();
    try {
      const { reads } = setup(3);
      const [first, second] = await Promise.all([cache.fetchQuery(agreementsQueryOptions), cache.fetchQuery(agreementsQueryOptions)]);
      assert.equal(first, second);
      assert.equal(reads.length, AGREEMENT_BATCH_SIZE);
      assert.equal(await cache.fetchQuery(agreementsQueryOptions), first);
      assert.equal(reads.length, AGREEMENT_BATCH_SIZE);
      const failure = new Error("RPC offline");
      setup(0, new Map([[1n, failure]]));
      await assert.rejects(cache.fetchQuery({ ...agreementsQueryOptions, staleTime: 0, retry: false }), (error) => error === failure);
      assert.equal(cache.getQueryData(agreementsQueryOptions.queryKey), first);
      assert.equal(cache.getQueryState(agreementsQueryOptions.queryKey).status, "error");
    } finally { cache.clear(); }
  });

  it("preserves the payment detail timeline's existing 20,000-block event range", async () => {
    const ranges = [];
    publicClient.getBlockNumber = async () => 25000n;
    publicClient.getLogs = async (request) => { ranges.push(request); return []; };
    const history = await recentEvents(2n);
    assert.equal(history.fromBlock, 25000n - RECENT_BLOCKS);
    assert.equal(history.toBlock, 25000n);
    assert.equal(ranges[0].fromBlock, 5000n);
    assert.equal(ranges.at(-1).toBlock, 25000n);
    assert.equal(ranges.length, 11);
  });
});
