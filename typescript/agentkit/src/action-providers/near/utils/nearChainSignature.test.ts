import { NEAR_MAINNET_NETWORK_ID, NEAR_TESTNET_NETWORK_ID } from "../../../network";
import {
  MPC_SIGNER_MAINNET,
  MPC_SIGNER_TESTNET,
  ROOT_PUBLIC_KEY_MAINNET,
  ROOT_PUBLIC_KEY_TESTNET,
} from "../constants";
import {
  AddressType,
  deriveChildPublicKey,
  generateAddress,
  getMpcAccountIdByNetwork,
  getRootPublicKey,
} from "./nearChainSignature";

describe("Chain Signature Utils", () => {
  describe("deriveChildPublicKey", () => {
    it("should derive a valid child public key", () => {
      const accountId = "omnitester.testnet";
      const derivedKey = deriveChildPublicKey(
        "secp256k1:4NfTiv3UsGahebgTaHyD9vF8KYKMBnfd6kh94mK6xv8fGBiJB8TBtFMP5WWXz6B89Ac1fbpzPwAvoyQebemHFwx3",
        accountId,
        "ethereum-1",
      );

      expect(derivedKey).toEqual(
        "046a99e52f042a96ea2293a69f3154b63c06cd0770cf89a46d0d1ab331dab64d8b1472638899edf8904e1c06ac7fce3e47ea1403279341c147303fd6c5df806623",
      );
    });

    it("should derive a valid child public key [against signet]", async () => {
      const accountId = "omnitester.testnet";
      const derivedKey = deriveChildPublicKey(
        "secp256k1:4NfTiv3UsGahebgTaHyD9vF8KYKMBnfd6kh94mK6xv8fGBiJB8TBtFMP5WWXz6B89Ac1fbpzPwAvoyQebemHFwx3",
        accountId,
        "ethereum-1",
      );

      expect(derivedKey).toEqual(
        "046a99e52f042a96ea2293a69f3154b63c06cd0770cf89a46d0d1ab331dab64d8b1472638899edf8904e1c06ac7fce3e47ea1403279341c147303fd6c5df806623",
      );
    });
  });

  describe("generateAddress", () => {
    it("should generate a valid EVM address", () => {
      const cases = [
        {
          publicKey:
            "secp256k1:4NfTiv3UsGahebgTaHyD9vF8KYKMBnfd6kh94mK6xv8fGBiJB8TBtFMP5WWXz6B89Ac1fbpzPwAvoyQebemHFwx3",
          accountId: "omnitester.testnet",
          path: "ethereum-1",
          addressType: AddressType.EVM,
          expectedAddress: "0xd8d25820c9b9e2aa9cce55504355e500efcce715",
          expectedPublicKey:
            "04e612e7650febebc50b448bf790f6bdd70a8a6ce3b111a1d7e72c87afe84be776e36226e3f89de1ba3cbb62c0f3fc05bffae672c9c59d5fa8a4737b6547c64eb7",
        },
        {
          publicKey:
            "secp256k1:3tFRbMqmoa6AAALMrEFAYCEoHcqKxeW38YptwowBVBtXK1vo36HDbUWuR6EZmoK4JcH6HDkNMGGqP1ouV7VZUWya",
          accountId: "example.near",
          path: "ethereum-1",
          addressType: AddressType.EVM,
          expectedAddress: "0xef4ea05e5c11057decc8e1bd6f5369f2acd91fa5",
          expectedPublicKey:
            "04f981e58fa26199180ea71b627362c7d1a6bebd73f61fedbe2e0acea5c2e75128a327822ee298967e485d787e0e98163b7d385516811f913cb7256182f5a20394",
        },
        {
          publicKey:
            "secp256k1:3tFRbMqmoa6AAALMrEFAYCEoHcqKxeW38YptwowBVBtXK1vo36HDbUWuR6EZmoK4JcH6HDkNMGGqP1ouV7VZUWya",
          accountId: "example.near",
          path: "ethereum-2",
          addressType: AddressType.EVM,
          expectedAddress: "0x273eeb4d7651d9296ec5bd9a6ceebca219101cb8",
          expectedPublicKey:
            "04599038b49d32f1f345e4321dca5f3619d96100126ef940f904c1f7cb0ada3ad8f2bb44672ba5b686940230505d0bdaf4764ee7df58a5300691f60eeff095e9fc",
        },
      ];

      cases.forEach(
        ({ publicKey, accountId, path, addressType, expectedAddress, expectedPublicKey }) => {
          const result = generateAddress(publicKey, accountId, path, addressType);

          expect(result).toHaveProperty("address", expectedAddress);
          expect(result).toHaveProperty("publicKey", expectedPublicKey);
        },
      );
    });

    it("should throw an error for unsupported address types", () => {
      const publicKey =
        "secp256k1:4NfTiv3UsGahebgTaHyD9vF8KYKMBnfd6kh94mK6xv8fGBiJB8TBtFMP5WWXz6B89Ac1fbpzPwAvoyQebemHFwx3";
      const accountId = "omnitester.testnet";
      const path = "0";
      const addressType = AddressType.BITCOIN_MAINNET_LEGACY;
      expect(() => generateAddress(publicKey, accountId, path, addressType)).toThrow(
        "Unsupported address type: bitcoin-mainnet-legacy",
      );
    });
  });

  describe("getRootPublicKey", () => {
    it("should return the correct root public key for testnet", () => {
      expect(getRootPublicKey(NEAR_TESTNET_NETWORK_ID)).toEqual(ROOT_PUBLIC_KEY_TESTNET);
    });

    it("should return the correct root public key for mainnet", () => {
      expect(getRootPublicKey(NEAR_MAINNET_NETWORK_ID)).toEqual(ROOT_PUBLIC_KEY_MAINNET);
    });

    it("should throw an error for unsupported networks", () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(() => getRootPublicKey("invalid-network" as any)).toThrow(
        "Unsupported network: invalid-network",
      );
    });
  });

  describe("getMpcAccountIdByNetwork", () => {
    it("should return the correct MPC signer for testnet", () => {
      expect(getMpcAccountIdByNetwork(NEAR_TESTNET_NETWORK_ID)).toEqual(MPC_SIGNER_TESTNET);
    });

    it("should return the correct MPC signer for mainnet", () => {
      expect(getMpcAccountIdByNetwork(NEAR_MAINNET_NETWORK_ID)).toEqual(MPC_SIGNER_MAINNET);
    });

    it("should throw an error for unsupported networks", () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(() => getMpcAccountIdByNetwork("invalid-network" as any)).toThrow(
        "Unsupported network: invalid-network",
      );
    });
  });
});
