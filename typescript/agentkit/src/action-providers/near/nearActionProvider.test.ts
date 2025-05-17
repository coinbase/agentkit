import { Connection } from "@near-js/accounts";
import { JsonRpcProvider } from "@near-js/providers";
import { InMemoryKeyStore } from "@near-js/keyStores";
import { NEAR_MAINNET_NETWORK, NEAR_MAINNET_NETWORK_ID, NEAR_NETWORK_ID } from "../../network";
import { NEARWalletProvider } from "../../wallet-providers";
import { NearActionProvider } from "./nearActionProvider";
import { MpcContract } from "./utils";

jest.mock("@near-js/utils", () => ({
  ...jest.requireActual("@near-js/utils"),
  getTransactionLastResult: jest.fn().mockReturnValue({
    big_r: {
      affine_point: "02ACE91E6368E5859640CB8E988D70E6C1551E3B8AEC897084C5A2797EF606CCE8",
    },
    s: {
      scalar: "3A84B3C0C157FFE0AC271A07F6ABB4BA8821E010F359FAEE05D82796122926F2",
    },
    recovery_id: 0,
  }),
}));

describe("NearActionProvider", () => {
  const actionProvider = new NearActionProvider();
  let mockWallet: jest.Mocked<NEARWalletProvider>;
  let mockProvider: jest.Mocked<JsonRpcProvider>;
  let mockConnection: jest.Mocked<Connection>;
  let mockSigner: jest.Mocked<InMemoryKeyStore>;

  const MOCK_ADDRESS = "wallet.near";
  const MOCK_CONTRACT = "contract.near";
  const MOCK_DESTINATION = "destination.near";
  const MOCK_TX_HASH = "5j2XGJZXq8McE9x4Y8EJ3f9tVQvFfY6zK7k1d9QXp6Bq";
  const ACCOUNT_ID = "jsvm.testnet";
  const MOCK_SIGNATURE = {
    big_r: {
      affine_point: "02ACE91E6368E5859640CB8E988D70E6C1551E3B8AEC897084C5A2797EF606CCE8",
    },
    s: {
      scalar: "3A84B3C0C157FFE0AC271A07F6ABB4BA8821E010F359FAEE05D82796122926F2",
    },
    recovery_id: 0,
  };

  beforeEach(() => {
    mockProvider = new JsonRpcProvider({
      url: "https://rpc.testnet.near.org",
    }) as jest.Mocked<JsonRpcProvider>;
    mockSigner = new InMemoryKeyStore();
    mockConnection = new Connection(NEAR_MAINNET_NETWORK, mockProvider, mockSigner, ACCOUNT_ID);

    mockWallet = {
      getAddress: jest.fn().mockReturnValue(MOCK_ADDRESS),
      getNetwork: jest.fn().mockReturnValue(NEAR_MAINNET_NETWORK),
      getName: jest.fn().mockReturnValue("NEAR Wallet"),
      getBalance: jest.fn().mockResolvedValue(BigInt(100000000000000000000)),
      nativeTransfer: jest.fn().mockResolvedValue(MOCK_TX_HASH as `0x${string}`),
      getAccount: jest.fn().mockReturnValue({
        accountId: MOCK_ADDRESS,
        connection: mockConnection,
        contract: MOCK_CONTRACT,
        destination: MOCK_DESTINATION,
        signAndSendTransaction: jest.fn().mockResolvedValue(MOCK_TX_HASH as `0x${string}`),
      }),
      getConnection: jest.fn().mockReturnValue(mockConnection),
      getPublicKey: jest.fn().mockReturnValue("0494da"),
      signAndSendTransaction: jest.fn().mockResolvedValue(MOCK_TX_HASH as `0x${string}`),
    } as unknown as jest.Mocked<NEARWalletProvider>;
  });

  describe("getCrossChainAddress", () => {
    it("should return the crosschain address when using default values", async () => {
      const args = {
        accountId: undefined,
        networkId: undefined,
        path: undefined,
        addressType: "evm",
      };

      const response = await actionProvider.getCrossChainAddress(mockWallet, args);

      expect(response).toEqual(
        "Generated cross chain address of type evm for account id wallet.near, network near-mainnet and derivation path account-1 is 0x5cf7ac588d5cdb35d8a9ed3d884f1a4245338db7",
      );
    });

    it("should return the crosschain address when using defined values", async () => {
      const args = {
        accountId: "omnitester.near",
        networkId: NEAR_MAINNET_NETWORK_ID as NEAR_NETWORK_ID,
        path: "account-1",
        addressType: "evm",
      };

      const response = await actionProvider.getCrossChainAddress(mockWallet, args);

      expect(response).toEqual(
        "Generated cross chain address of type evm for account id omnitester.near, network near-mainnet and derivation path account-1 is 0x9ee8197e1a04cc53ee976894082449d2f450ae34",
      );
    });
  });

  describe("getCrossChainPublicKey", () => {
    it("should return the crosschain public key when using default values", async () => {
      const args = {
        accountId: undefined,
        networkId: undefined,
        path: undefined,
      };

      const response = await actionProvider.getCrossChainPublicKey(mockWallet, args);

      const expectedMessagePart =
        "Computed public key for account id wallet.near, network near-mainnet and derivation path account-1 is";
      const expectedPublicKey =
        "04360c67764d827f09b08e8749eb4d7362ca825176f9d67c233b63aff64f4a6b947aee76cda76f1645952ed6e259bb270a76853da16d2601e4bf2e0c60b852c66d";

      expect(response).toEqual(`${expectedMessagePart} ${expectedPublicKey}`);
    });

    it("should return the crosschain public key when using defined values", async () => {
      const args = {
        accountId: "omnitester.near",
        networkId: NEAR_MAINNET_NETWORK_ID as NEAR_NETWORK_ID,
        path: "account-1",
      };

      const response = await actionProvider.getCrossChainPublicKey(mockWallet, args);

      const expectedMessagePart =
        "Computed public key for account id omnitester.near, network near-mainnet and derivation path account-1 is";
      const expectedPublicKey =
        "0494da94af0a6b62a8d247e4a7915018cb5ce069bd2e81f90cf6b8351f8d34645ca78cfafdaeb2b1879f2501581500899de03a3b8b4f345278525206b21eaa8735";

      expect(response).toEqual(`${expectedMessagePart} ${expectedPublicKey}`);
    });
  });

  describe("signPayload", () => {
    const big_r = MOCK_SIGNATURE.big_r.affine_point;
    const big_s = MOCK_SIGNATURE.s.scalar;
    const recoveryId = MOCK_SIGNATURE.recovery_id;

    beforeEach(() => {
      jest.spyOn(MpcContract.prototype, "getExperimentalSignatureDeposit").mockResolvedValue("1");
    });

    it("should sign a payload when passing non mandatory fields", async () => {
      const args = {
        path: undefined,
        payload: "",
      };

      const response = await actionProvider.signPayload(mockWallet, args);

      expect(response).toEqual(
        `The signature result is big_r: ${big_r}, big_s: ${big_s} and recovery_id: ${recoveryId}`,
      );
    });

    it("should sign a payload when passing all fields", async () => {
      const args = {
        path: "account-1",
        payload: "470637f6dcc98931d6d22afa2b491c20caf0c3ba595d707606fe7915c30ef0a7",
      };

      const response = await actionProvider.signPayload(mockWallet, args);

      expect(response).toEqual(
        `The signature result is big_r: ${big_r}, big_s: ${big_s} and recovery_id: ${recoveryId}`,
      );
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });
});
