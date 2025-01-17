import { Coinbase, Wallet, WalletData } from "@coinbase/coinbase-sdk";
import { CdpAgentkit } from "../cdp_agentkit";

const MOCK_MNEMONIC_PHRASE =
  "eternal phone creek robot disorder climb thought eternal noodle flat cage bubble liquid sting can";
const MOCK_WALLET_ID = "0x123456789abcdef";
const MOCK_WALLET_SEED = "0xc746290109d0b86162c428be6e27f552";
const MOCK_WALLET_JSON = `{"defaultAddressId":"0xabcdef123456789", "seed":"${MOCK_WALLET_SEED}", "walletId":"${MOCK_WALLET_ID}"}`;

describe("CdpAgentkit", () => {
  describe("initialization", () => {
    const mockWallet: jest.Mocked<Wallet> = {} as unknown as jest.Mocked<Wallet>;

    beforeEach(async () => {
      process.env.CDP_API_KEY_NAME = "test-key";
      process.env.CDP_API_KEY_PRIVATE_KEY = "test-private-key";

      jest.spyOn(Wallet, "create").mockResolvedValue(mockWallet);
    });

    afterEach(() => {
      jest.resetAllMocks();

      process.env.CDP_API_KEY_NAME = "";
      process.env.CDP_API_KEY_PRIVATE_KEY = "";
    });

    it("should successfully init with env", async () => {
      const options = {};
      const result = await CdpAgentkit.configureWithWallet(options);

      expect(result).toBeDefined();
      expect(Wallet.create).toHaveBeenCalledWith({
        networkId: Coinbase.networks.BaseSepolia,
      });
    });

    it("should successfully init with options and without env", async () => {
      const options = {
        cdpApiKeyName: "test-key",
        cdpApiKeyPrivateKey: "test-private-key",
      };

      process.env.CDP_API_KEY_NAME = "";
      process.env.CDP_API_KEY_PRIVATE_KEY = "";

      const result = await CdpAgentkit.configureWithWallet(options);

      expect(result).toBeDefined();
      expect(Wallet.create).toHaveBeenCalledWith({
        networkId: Coinbase.networks.BaseSepolia,
      });
    });

    it("should successfully init with wallet data", async () => {
      const options = {
        cdpWalletData: MOCK_WALLET_JSON,
      };

      jest.spyOn(Wallet, "import").mockResolvedValue(mockWallet);

      const result = await CdpAgentkit.configureWithWallet(options);

      expect(result).toBeDefined();
      expect(Wallet.import).toHaveBeenCalledWith(JSON.parse(MOCK_WALLET_JSON) as WalletData);
    });

    it("should successfully init with mnemonic Phrase ", async () => {
      const networkId = Coinbase.networks.BaseSepolia;

      const options = {
        mnemonicPhrase: MOCK_MNEMONIC_PHRASE,
      };

      jest.spyOn(Wallet, "import").mockResolvedValue(mockWallet);

      const result = await CdpAgentkit.configureWithWallet(options);

      expect(result).toBeDefined();
      expect(Wallet.import).toHaveBeenCalledWith(
        { mnemonicPhrase: MOCK_MNEMONIC_PHRASE },
        networkId,
      );
    });

    it("should successfully init with mnemonic Phrase ", async () => {
      const networkId = Coinbase.networks.BaseMainnet;

      const options = {
        mnemonicPhrase: MOCK_MNEMONIC_PHRASE,
        networkId,
      };

      jest.spyOn(Wallet, "import").mockResolvedValue(mockWallet);

      const result = await CdpAgentkit.configureWithWallet(options);

      expect(result).toBeDefined();
      expect(Wallet.import).toHaveBeenCalledWith(
        { mnemonicPhrase: MOCK_MNEMONIC_PHRASE },
        networkId,
      );
    });

    it("should fail init without env", async () => {
      const options = {};

      process.env.CDP_API_KEY_NAME = "";
      process.env.CDP_API_KEY_PRIVATE_KEY = "";

      await expect(CdpAgentkit.configureWithWallet(options)).rejects.toThrow(
        "CDP_API_KEY_NAME is required but not provided",
      );
      expect(Wallet.create).not.toHaveBeenCalled();
    });
  });
});
