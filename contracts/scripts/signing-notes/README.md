# Signing flow

1. Call `digestFor(id, action, validUntil)` on the intended Rewind deployment.
   `action` is `uint8`: `1` for release, `2` for refund. `validUntil` is a
   `uint256` Unix timestamp in seconds chosen by the buyer.
2. Sign those exact **32 digest bytes** with the buyer's registered ML-DSA-87
   key using `pqcSign` from `@qorechain/sdk`. Decode the returned `0x` digest
   into bytes before signing. Do not sign the hexadecimal text, add an Ethereum
   message prefix, or hash the digest again.
3. Pass the resulting **4,627-byte signature**, encoded as hex for the ABI, to
   `release(id, validUntil, pqSignature)` or `refund(id, validUntil, pqSignature)`
   from the stored buyer's account. Use the same ID, action and expiry used in
   the digest call.

Rewind loads the buyer's public key from `pqcKeyStatus`; the caller never supplies
it. The current contract requires registration, proven possession, algorithm ID
1 and a 2,592-byte public key. A fresh unrelated keypair cannot authorize the buyer.

The contract hashes ABI-encoded `REWIND_V1`, chain ID, deployment address,
agreement ID, action, buyer, seller, amount, terms hash and expiry. Calling
`digestFor` avoids duplicating that encoding in the client.

This describes the SDK signing primitive. It makes no assumption about whether
or how QoreX exposes ML-DSA-87 signing. Never put a private signing key or recovery
phrase into frontend environment variables or logs.

The account also needs the chain's EVM authorization window to send the settlement
transaction. That window and Rewind's agreement signature are separate checks.
