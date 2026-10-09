import { standingWitnessActionProvider, StandingWitnessActionProvider } from "./standingWitnessActionProvider";
import { WalletProvider } from "../../wallet-providers";

describe("StandingWitnessActionProvider", () => {
  let provider: StandingWitnessActionProvider;
  let mockWallet: jest.Mocked<WalletProvider>;

  beforeEach(() => {
    provider = standingWitnessActionProvider({ defaultMock: true });
    mockWallet = {} as unknown as jest.Mocked<WalletProvider>;
  });

  it("supports network", () => {
    expect(provider.supportsNetwork({ protocolFamily: "evm", networkId: "base-mainnet" })).toBe(true);
  });

  it("initializes action provider with standing_witness name", () => {
    expect(provider.name).toBe("standing_witness");
  });
});
