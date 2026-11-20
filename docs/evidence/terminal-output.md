# Terminal output from the testnet runs (20 November 2026)

## Scoped window status (about 7 minutes after opening)

This is the exact output copied from the developer's terminal, unedited.

```text
account:  0x42B70a2Be6F875989b18DA907639479802101DB8  (qor1g2ms52lxlp6e3xccm2g8vw28nqppq8dc5e02fn)
PQC key:  registered
window:   live; 523 blocks, 20 txs, 15000000 uqor left
scope nativeOnly: false
scope allowedTargets: 0x775BbF36986FaBC54b64955c1D9b8EdB388E7c20
REST read-back omits validators; its scope cannot be confirmed.
REST read-back omits stakingValidators; its scope cannot be confirmed.
REST read-back omits ibcReceivers; its scope cannot be confirmed.
```

## Out-of-scope transfer attempt (attack-demo transfer-out --send)

This is the exact output copied from the developer's terminal, unedited.

```text
a classical-key attack demonstration
Would transfer 1000000000000 wei (1 uqor) from the buyer to 0x000000000000000000000000000000000000dEaD.
Window enforcement happens when the chain admits the transaction, not in a simulation.
Rewind contract: 0x775BbF36986FaBC54b64955c1D9b8EdB388E7c20
buyer: 0x42B70a2Be6F875989b18DA907639479802101DB8
scope nativeOnly: false
scope allowedTargets: 0x775BbF36986FaBC54b64955c1D9b8EdB388E7c20
REST read-back omits validators; its scope cannot be confirmed.
REST read-back omits stakingValidators; its scope cannot be confirmed.
REST read-back omits ibcReceivers; its scope cannot be confirmed.
buyer balance: 99.1313264 QOR
PASS: Chain rejected the broadcast with a recognized window refusal (exhausted). This reply alone does not distinguish target scoping from allowances changing after the readiness check.
```

Control: in the same live window, createAgreement to the Rewind contract succeeded (agreement 3, transaction 0x401cfe0a0a7244cef86479e4fc0301b7555f3113b8d4b8c8d519bbb718e08f79), so the window had not run out of transactions. This is supporting evidence, not a controlled comparison with an unscoped window.
