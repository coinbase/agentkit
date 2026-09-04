/**
 * Real, valid X-BYTE-Attestation receipt captured from
 * the live PayPerByte gateway (2026-08-21T03:55:08.648Z, https://x402.payperbyte.io/feeds/sanctions-screen), publisher
 * 0xB48CCc9e3ab67041e3b5D09700138E45cda6AeA8 = the gateway delivery attester.
 *
 * Re-verified by regen_from_capture.mjs immediately before this file was generated: byte
 * length, keccak256(body) == payloadHash, and EIP-712 signer recovery == publisher all
 * checked true. Scanned for degraded-response markers (non-null error/timeout/null-field/
 * off-feed patterns) with zero matches. The body's documented
 * `broadcast disabled (SANCTIONS_SCREEN_BROADCAST=0)` disabled-state note is whitelisted by the
 * scanner as an intentional flag in a healthy response, not a degraded-response marker.
 *
 */
export const REAL_FIXTURE_BODY =
  '{"answer":{"v":"sanctions-screen/v1","ts":1787284507,"query":{"address":"0x833589fcd6edb6e08f4c7c32d4f71b54bda02913","name":null,"chain":null},"verdict":"ALLOW","score":100,"reasons":["no match on the OFAC SDN list (19249 entries; list published 2026-08-20, fetched 2026-08-20T23:42:38Z, sha256 50213298d936901a\\u2026)","no match on the OFAC Consolidated (non-SDN) list (481 entries; list published 2026-08-20, fetched 2026-08-20T23:42:41Z, sha256 5a629469398539ac\\u2026)"],"signals":{"sdn":{"list_available":true,"address_hit":false,"address_matches":[],"name_exact_hit":false,"name_exact_matches":[],"name_fuzzy_hit":false,"name_fuzzy_matches":[],"list_state":{"source":"OFAC SDN (Specially Designated Nationals and Blocked Persons)","source_url":"https://sanctionslistservice.ofac.treas.gov/api/PublicationPreview/exports/SDN.CSV","published_date":"2026-08-20","fetched_at":"2026-08-20T23:42:38Z","content_sha256":"50213298d936901a1aaad7bb19c968dab9e82fa07e8c808aacfae8fcea3d870e","entry_count":19249,"age_days":0,"stale":false},"error":null},"consolidated":{"list_available":true,"address_hit":false,"address_matches":[],"name_exact_hit":false,"name_exact_matches":[],"name_fuzzy_hit":false,"name_fuzzy_matches":[],"list_state":{"source":"OFAC Consolidated (non-SDN) Sanctions List","source_url":"https://sanctionslistservice.ofac.treas.gov/api/PublicationPreview/exports/CONS_PRIM.CSV","published_date":"2026-08-20","fetched_at":"2026-08-20T23:42:41Z","content_sha256":"5a629469398539aca2d180a086543e2161d1203fb2a3c9c737b1d682544df5b1","entry_count":481,"age_days":0,"stale":false},"error":null}},"list_state":{"sdn":{"source":"OFAC SDN (Specially Designated Nationals and Blocked Persons)","source_url":"https://sanctionslistservice.ofac.treas.gov/api/PublicationPreview/exports/SDN.CSV","published_date":"2026-08-20","fetched_at":"2026-08-20T23:42:38Z","content_sha256":"50213298d936901a1aaad7bb19c968dab9e82fa07e8c808aacfae8fcea3d870e","entry_count":19249,"age_days":0,"stale":false},"consolidated":{"source":"OFAC Consolidated (non-SDN) Sanctions List","source_url":"https://sanctionslistservice.ofac.treas.gov/api/PublicationPreview/exports/CONS_PRIM.CSV","published_date":"2026-08-20","fetched_at":"2026-08-20T23:42:41Z","content_sha256":"5a629469398539aca2d180a086543e2161d1203fb2a3c9c737b1d682544df5b1","entry_count":481,"age_days":0,"stale":false}},"retrieved_at":"2026-08-21T03:55:07Z","methodology":"ss-v1","input_hashes":{"sdn":"0x9bcbbaa69c4040ffc3513afab8080366074718c49a18071fc2c9fd865af6f8d4","consolidated":"0xeee09b9059da1fb85d29fdc01bd7e7c6d3b8d76d3712a5cd7937e2bb66d0469b"},"source":"OFAC SDN + OFAC Consolidated (non-SDN) via sanctionslistservice.ofac.treas.gov (official Treasury exports)","error":null},"broadcast":{"ok":false,"tx":null,"delivered":0,"note":"broadcast disabled (SANCTIONS_SCREEN_BROADCAST=0)"},"attestation":{"payloadHash":"0xbe58daa362cf94a4b4d6dc90c8415c306c06d69eedb5f599a69e14e62cc79464","payloadLength":2720,"deadline":2102644507,"signer":"0x344ECaCDe6566294c31397445c98b62a3EEEA456","signature":"0xb63cf806e4d74bc8323de684f502ceda8c04e2e3bbc049dc9d631bd276214dac02dfbb22d624b28deff1359b857e5110247d4c2f7e147232f2fddaca0a084ed21b","domain":{"name":"BYTE Library","version":"1","chainId":421614,"verifyingContract":"0x44729bB148F46d8Db509E47b0453edc271e06e95"}}}\n';

export const REAL_FIXTURE_ATTESTATION = {
  alg: "EIP712-PayloadAttestation",
  domain: {
    name: "BYTE Library",
    version: "1",
    chainId: 421614,
    verifyingContract: "0x44729bB148F46d8Db509E47b0453edc271e06e95",
  },
  publisher: "0xB48CCc9e3ab67041e3b5D09700138E45cda6AeA8",
  payloadHash: "0xb14ef4b30838a2964800ace5f02f592834e14c695be5862b54b6ff8d2e1647d3",
  payloadLength: 3312,
  deadline: 2102644507,
  signature:
    "0x575399d1e3f8fdcfc5586c93be797951a83802b718621aa1e1d938dbf56f443434e1ec4cb18bead30bc4ea2582f587ee1797ea8580334bcd42d682ed5eea6cf11c",
};
