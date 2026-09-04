/**
 * Same CREATE2 AnchorRegistry address across Base, Arbitrum One, and Ink —
 * see https://github.com/giskard09/argentum-core/blob/master/docs/spec/counterparty-ref.md
 */
export const ANCHOR_REGISTRY_ADDRESS = "0x49fEcA52bC634a9Ab773226D16619deC547794aa";

/** keccak256("Anchored(bytes32,address,uint256)") */
export const ANCHORED_TOPIC0 = "0xfe2289542f7a0110ac112c3a4d712afdcaaf2900a1326f4e6f340b563a0e8734";

export const RPC_ENDPOINTS: Record<string, string> = {
  base: "https://mainnet.base.org",
  arbitrum: "https://arb1.arbitrum.io/rpc",
  ink: "https://rpc-gel.inkonchain.com",
};
