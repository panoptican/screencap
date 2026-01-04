# Friends + Rooms E2EE: crypto spec

## Threat model

- Server, database, logs, and blob storage may be observed or compromised.
- Client device compromise breaks that device’s confidentiality and integrity.
- Goals:
  - Confidentiality: server must not learn message, caption, or image plaintext.
  - Integrity: server must not accept unauthorized writes.
  - Authorization: reads require membership or possession of a public-link key.

## Identity and device keys

Each installation has a single device identity (v1).

- Device signing keypair: Ed25519
  - Purpose: authenticate API requests.
- Device key agreement keypair: X25519
  - Purpose: E2EE key distribution envelopes and DM shared-key derivation.

Encoding

- Public keys: base64(der(spki))
- Private keys: base64(der(pkcs8)) stored encrypted at rest via Electron `safeStorage`.

## Signed request authentication

Headers

- `x-user-id`: server-assigned user id
- `x-device-id`: server-assigned device id
- `x-ts`: unix milliseconds as decimal string
- `x-sig`: base64 signature

Body hash

- `bodyHash = sha256(rawRequestBodyBytes).hex`
- For requests without a body, the body is empty bytes.

Canonical string (UTF-8)

```
{METHOD}\n{PATH}\n{TS}\n{BODY_HASH_HEX}
```

Signature

- `x-sig = base64(Ed25519-SIGN(canonicalStringUtf8))`
- Verify within a timestamp window: `abs(nowMs - tsMs) <= 5 minutes`.

## Rooms and key distribution

Room key

- `RoomKey`: 32 random bytes generated client-side.
- Storage: cached locally encrypted at rest (Electron `safeStorage`).

Envelope format

RoomKey distribution uses per-recipient-device envelopes.

- Sender generates ephemeral X25519 keypair.
- Shared secret:
  - `ss = X25519(ephemeralPriv, recipientDhPub)`
- Derive an AEAD key:
  - `k = HKDF-SHA256(ikm=ss, salt="", info="room-key-envelope", length=32)`
- Encrypt:
  - `nonce = random(12)`
  - `ct = AES-256-GCM(k, nonce).encrypt(RoomKey)`
- Stored JSON:

```
{
  "v": 1,
  "ephemeralPub": "<base64 der(spki)>",
  "nonce": "<base64>",
  "ciphertext": "<base64 nonce||ct>"
}
```

## Encrypted timeline events and images

Key separation

- `eventKey = HKDF-SHA256(ikm=RoomKey, salt="", info="room-event", length=32)`
- `imageKey = HKDF-SHA256(ikm=RoomKey, salt="", info="room-image", length=32)`

Ciphertext format (binary)

- `nonce (12) || ciphertext || tag (16)`

Event payload

- `payload_ciphertext`: base64(ciphertextFormat(payloadJsonUtf8))
- `payloadJson`:

```
{
  "v": 1,
  "caption": "<string|null>",
  "image": { "ref": "<string|null>" }
}
```

Image bytes

- Image ciphertext bytes are uploaded to blob storage as raw bytes in `ciphertext format`.
- `image_ref` is an opaque blob url or path stored in the event row.

## Chat encryption

DM (v1 single-device)

- `ss = X25519(myDhPriv, friendDhPub)`
- `dmKey = HKDF-SHA256(ikm=ss, salt="", info="dm", length=32)`
- Messages: AES-256-GCM with `dmKey` and fresh 12-byte nonce per message.

Project group chat

- `chatKey = HKDF-SHA256(ikm=RoomKey, salt="", info="chat", length=32)`
- Messages: AES-256-GCM with `chatKey` and fresh 12-byte nonce per message.

## Public links

Public rooms allow read access via possession of the room key.

- The public link carries the key in the URL fragment, not query params.
- Example shape:
  - `/p/{publicId}#k={base64url(roomKey)}`
