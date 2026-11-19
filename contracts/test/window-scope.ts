import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { openEvmWindowMsg } from "@qorechain/sdk";
import { toQorAddress } from "@qorechain/evm";
import { parseWindowScope, readWindowStatus, windowScopeLines } from "../scripts/window-scope.js";
import { resolveRewindAddress } from "../scripts/rewind-address.js";

const REWIND = "0x775BbF36986FaBC54b64955c1D9b8EdB388E7c20";
const OTHER = "0x0000000000000000000000000000000000000011";
const TAINT = "SENSITIVE_TEST_MARKER_DO_NOT_ECHO";

describe("Window scope and deployment address (offline)", () => {
  it("uses an explicit address override or the exact Ignition manifest entry", () => {
    assert.equal(resolveRewindAddress(undefined, { "RewindModule#Rewind": REWIND }), REWIND);
    assert.equal(resolveRewindAddress(` ${OTHER} `, { "RewindModule#Rewind": REWIND }), OTHER);
  });

  it("refuses missing/invalid addresses, and never silently replaces an invalid override", () => {
    for (const [override, stored] of [
      [undefined, undefined], [undefined, {}], [undefined, { "CounterModule#Counter": REWIND }],
      [undefined, { "RewindModule#Rewind": TAINT }], ["", { "RewindModule#Rewind": REWIND }],
      [TAINT, { "RewindModule#Rewind": REWIND }], ["0x0000000000000000000000000000000000000000", {}],
    ] as const) {
      assert.throws(() => resolveRewindAddress(override, stored), (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.match(error.message, /REWIND_ADDRESS/);
        assert.equal(error.message.includes(TAINT), false);
        return true;
      });
    }
  });

  it("passes allowedTargets at the SDK's top level without changing default allowances", () => {
    const params = { sender: toQorAddress(OTHER), blocks: 600n, maxTxs: 5n, maxValue: 100000n };
    const unscoped = openEvmWindowMsg(params);
    const scoped = openEvmWindowMsg({ ...params, allowedTargets: [REWIND] });
    assert.equal(scoped.typeUrl, "/qorechain.pqc.v1.MsgOpenEVMWindow");
    assert.deepEqual(scoped.value, { ...unscoped.value, allowedTargets: [REWIND] });
    assert.equal(scoped.value.nativeOnly, false);
    assert.deepEqual(scoped.value.validators, []);
    assert.deepEqual(scoped.value.stakingValidators, []);
    assert.deepEqual(scoped.value.ibcReceivers, []);
  });

  it("keeps an omitted scope distinct from an explicitly empty scope", () => {
    const missing = parseWindowScope({ found: true, live: true });
    assert.equal(missing.nativeOnly, undefined);
    assert.equal(missing.allowedTargets, undefined);
    assert.equal(missing.issues.length, 5);
    assert.match(windowScopeLines(missing).join("\n"), /REST read-back omits allowedTargets/);
    const empty = parseWindowScope({ native_only: false, allowed_targets: [], validators: [], staking_validators: [], ibc_receivers: [] });
    assert.equal(empty.nativeOnly, false);
    assert.deepEqual(empty.allowedTargets, []);
    assert.equal(empty.issues.length, 0);
    assert.match(windowScopeLines(empty).join("\n"), /\[\] \(any recipient\)/);
  });

  it("reads camelCase and snake_case fields and reports only public scope facts", () => {
    const body = { nativeOnly: false, allowedTargets: [REWIND], validators: [OTHER], stakingValidators: [], ibcReceivers: [TAINT] };
    const scope = parseWindowScope(body);
    assert.deepEqual(scope.allowedTargets, [REWIND]);
    const lines = windowScopeLines(scope).join("\n");
    assert.ok(lines.includes(REWIND));
    assert.ok(lines.includes(OTHER));
    assert.ok(lines.includes("ibcReceivers: 1 entries"));
    assert.equal(lines.includes(TAINT), false);
  });

  it("never echoes malformed RPC scope values", () => {
    const scope = parseWindowScope({ native_only: TAINT, allowed_targets: [REWIND, TAINT], validators: [TAINT], staking_validators: [TAINT], ibc_receivers: TAINT });
    assert.equal(scope.allowedTargets, undefined);
    assert.equal(scope.nativeOnly, undefined);
    assert.equal(scope.issues.length, 5);
    assert.equal(windowScopeLines(scope).join("\n").includes(TAINT), false);
  });

  it("captures omission from one injected REST response without another request", async () => {
    let requests = 0;
    const { window, scope } = await readWindowStatus({
      rest: "https://offline.invalid", address: OTHER,
      fetch: async (url) => {
        requests++;
        assert.equal(url, `https://offline.invalid/qorechain/pqc/v1/evm_window/${toQorAddress(OTHER)}`);
        return { ok: true, status: 200, json: async () => ({ found: true, live: true, remaining_txs: "5" }) };
      },
    });
    assert.equal(requests, 1);
    assert.equal(window.live, true);
    assert.deepEqual(window.allowedTargets, []); // Installed parser's default.
    assert.equal(scope.allowedTargets, undefined); // Actual omission is retained.
  });

  it("preserves a scoped target through the installed parser and presence check", async () => {
    const result = await readWindowStatus({ rest: "https://offline.invalid", address: OTHER,
      fetch: async () => ({ ok: true, status: 200, json: async () => ({ found: true, native_only: false, allowed_targets: [REWIND] }) }),
    });
    assert.deepEqual(result.scope.allowedTargets, [REWIND]);
    assert.deepEqual(result.window.allowedTargets, [REWIND]);
  });
});
