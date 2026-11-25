import { createHash } from "node:crypto";
import canonicalize from "canonicalize";
import type { AgentMediateClient } from "@agent-mediate/sdk";
import { EvmWalletProvider } from "../../wallet-providers";
import { Network } from "../../network";
import {
  AgentMediateActionProvider,
  agentMediateActionProvider,
} from "./agentMediateActionProvider";
import {
  CheckHonoursSchema,
  FileEscrowDisputeSchema,
  SubmitSealedOfferSchema,
  VerifyOutcomeSchema,
} from "./schemas";

const MOCK_RULES_VERSION = "1.4.0";
const MOCK_RULES_HASH = "10b48aa0d8a4a71808f5550f951ad128aa0af44b775b2c88c73ddb1dd1cee173";
const MOCK_RESPONDENT_DID = "did:key:z6Mkn42ijWNFD285Ru7xAfVPtVB1LRpmGe5f649fDwxPEanY";
const MOCK_AGENT_DID = "did:key:z6MkpTHR8VNsBxYAAWHut2Geadd9jSwuBV8xRoAnwWsdvktH";

// Avoid stray outbound analytics requests from @CreateAction during offline unit tests.
jest.mock("../../analytics", () => ({
  sendAnalyticsEvent: jest.fn().mockResolvedValue(undefined),
}));

// Mock @agent-mediate/sdk (ESM-only) for Jest's CJS test runner, mirroring erc8004/clanker tests.
jest.mock("@agent-mediate/sdk", () => {
  const productionUrl = "https://api.ai-agents-mediation.com";
  const platformDid = "did:key:z6Mkg7r4aHyPrNKYy1gbWGXu15VgyN9fCbhqKVwftdhHxJ3W";
  const agentDid = "did:key:z6MkpTHR8VNsBxYAAWHut2Geadd9jSwuBV8xRoAnwWsdvktH";
  const canonicalJson = (value: unknown): string => {
    const out = canonicalize(value);
    if (typeof out !== "string") {
      throw new Error("Value cannot be canonicalized");
    }
    return out;
  };
  const contractHash = (value: unknown): string =>
    createHash("sha256").update(canonicalJson(value)).digest("hex");

  return {
    AgentMediateClient: jest.fn(),
    agentKeyFromPem: jest.fn(() => ({ did: agentDid })),
    canonicalJson,
    contractHash,
    DEFAULT_PRODUCTION_PLATFORM_DIDS: {
      [productionUrl]: platformDid,
    },
    generateAgentKey: jest.fn(() => ({ did: agentDid })),
    PRODUCTION_API_URL: productionUrl,
    RULES_HASH: "10b48aa0d8a4a71808f5550f951ad128aa0af44b775b2c88c73ddb1dd1cee173",
    RULES_VERSION: "1.4.0",
  };
});

describe("AgentMediateActionProvider", () => {
  let provider: AgentMediateActionProvider;
  let mockWallet: jest.Mocked<EvmWalletProvider>;
  let mockClient: jest.Mocked<
    Pick<AgentMediateClient, "did" | "checkHonours" | "fileDispute" | "submitOffer" | "outcome">
  >;

  beforeEach(() => {
    jest.clearAllMocks();

    mockWallet = {
      getName: jest.fn().mockReturnValue("test-wallet"),
      getAddress: jest.fn().mockReturnValue("0x1111111111111111111111111111111111111111"),
      getNetwork: jest.fn().mockReturnValue({
        protocolFamily: "evm",
        networkId: "base-mainnet",
        chainId: "8453",
      } as Network),
    } as unknown as jest.Mocked<EvmWalletProvider>;

    mockClient = {
      did: MOCK_AGENT_DID,
      checkHonours: jest.fn().mockResolvedValue({
        entry: {
          domain: "vendor.example",
          qualifiedHonoredCount: 4,
          verifiedDomainCounterparties: 3,
          uncuredBreachCount: 0,
        },
        signedAttestation: null,
      }),
      fileDispute: jest.fn().mockResolvedValue({
        disputeId: "dsp_0123456789abcdef0123456789abcdef",
        view: { status: "AWAITING_RESPONDENT", nextActions: ["wait_for_change"] },
        notice: { noticeUrl: "https://api.ai-agents-mediation.com/n/tok_demo" },
      }),
      submitOffer: jest.fn().mockResolvedValue({
        view: {
          status: "BARGAINING",
          nextActions: ["submit_offer"],
          proposalWithinYourMandate: true,
          proposalMeetsYourWalkaway: true,
          bargaining: {
            round: 2,
            roundDeadline: 1_800_003_600_000,
            openProposal: {
              id: "prop_2",
              round: 2,
              terms: { refundMicroUsdc: 75_000_000, remediationHours: 2 },
            },
          },
        },
      }),
      outcome: jest.fn().mockResolvedValue({
        document: {
          type: "agent-mediate/settlement-instruction/v1",
          disputeId: "dsp_0123456789abcdef0123456789abcdef",
          rulesVersion: MOCK_RULES_VERSION,
          rulesHash: MOCK_RULES_HASH,
          method: "PROPOSAL_ACCEPTED",
          parties: { contractHash: "a".repeat(64) },
          terms: { refundMicroUsdc: 75_000_000, remediationHours: 2 },
        },
        proof: { type: "Ed25519Signature2026" },
      }),
    };

    provider = agentMediateActionProvider({
      client: mockClient as unknown as AgentMediateClient,
    });
  });

  describe("schemas", () => {
    it("parses defaults on FileEscrowDisputeSchema and validates all action schemas", () => {
      expect(CheckHonoursSchema.parse({ subject: "vendor.example" })).toEqual({
        subject: "vendor.example",
      });

      const parsedDispute = FileEscrowDisputeSchema.parse({
        respondentId: MOCK_RESPONDENT_DID,
        escrow: null,
        contractHash: "a".repeat(64),
        claimSummary: "SLA outage",
        requestedRemedy: "Partial refund",
        maxRefundMicroUsdc: 100_000_000,
        refundStepMicroUsdc: null,
        includeRemediationHours: null,
        minAcceptableRefundMicroUsdc: null,
        determinationConsent: null,
        requireDelivery: null,
      });
      expect(parsedDispute.refundStepMicroUsdc).toBe(1_000_000);
      expect(parsedDispute.includeRemediationHours).toBe(true);
      expect(parsedDispute.minAcceptableRefundMicroUsdc).toBe(0);
      expect(parsedDispute.determinationConsent).toBe(false);
      expect(parsedDispute.requireDelivery).toBe(false);

      expect(
        SubmitSealedOfferSchema.safeParse({
          disputeId: "dsp_0123456789abcdef0123456789abcdef",
          round: 1,
          offer: { refundMicroUsdc: 50_000_000 },
          weights: null,
          walkaway: null,
          limits: null,
          proposalResponse: null,
        }).success,
      ).toBe(true);

      expect(
        VerifyOutcomeSchema.safeParse({
          disputeId: "dsp_0123456789abcdef0123456789abcdef",
          expectedContractHash: null,
          capturedAmountMicroUsdc: null,
        }).success,
      ).toBe(true);
    });
  });

  describe("getActions", () => {
    it("registers all four decorated actions and invokes them via ActionProvider", async () => {
      const actions = provider.getActions(mockWallet);
      expect(actions.map(a => a.name).sort()).toEqual([
        "AgentMediateActionProvider_check_honours",
        "AgentMediateActionProvider_file_escrow_dispute",
        "AgentMediateActionProvider_submit_offer",
        "AgentMediateActionProvider_verify_outcome",
      ]);

      const checkAction = actions.find(a => a.name === "AgentMediateActionProvider_check_honours")!;
      const parsed = JSON.parse(await checkAction.invoke({ subject: "vendor.example" }));
      expect(parsed.verified).toBe(true);
      expect(parsed.listed).toBe(true);
    });
  });

  describe("supportsNetwork", () => {
    it("supports Base mainnet, Base Sepolia, and generic EVM networks only", () => {
      expect(
        provider.supportsNetwork({
          protocolFamily: "evm",
          networkId: "base-mainnet",
          chainId: "8453",
        }),
      ).toBe(true);
      expect(
        provider.supportsNetwork({
          protocolFamily: "evm",
          networkId: "base-sepolia",
          chainId: "84532",
        }),
      ).toBe(true);
      expect(provider.supportsNetwork({ protocolFamily: "evm" })).toBe(true);
      expect(
        provider.supportsNetwork({
          protocolFamily: "evm",
          networkId: "ethereum-mainnet",
          chainId: "1",
        }),
      ).toBe(false);
      expect(provider.supportsNetwork({ protocolFamily: "svm", networkId: "solana-mainnet" })).toBe(
        false,
      );
    });
  });

  describe("checkHonours", () => {
    it("verifies counterparty standing via checkHonours ($0.00)", async () => {
      const out = JSON.parse(await provider.checkHonours({ subject: "vendor.example" }));
      expect(out.verified).toBe(true);
      expect(out.listed).toBe(true);
      expect(out.entry.qualifiedHonoredCount).toBe(4);
    });

    it("returns a formatted error message when lookup fails", async () => {
      mockClient.checkHonours.mockRejectedValueOnce(new Error("Network timeout"));
      const res = await provider.checkHonours({ subject: "vendor.example" });
      expect(res).toContain("Error checking Agent-Mediate Honours Roll");
      expect(res).toContain("Network timeout");
    });
  });

  describe("fileEscrowDispute", () => {
    it("binds x402r AuthCaptureEscrow PaymentInfo into deterministic JCS contractHash and files dispute", async () => {
      const out = JSON.parse(
        await provider.fileEscrowDispute(mockWallet, {
          respondentId: MOCK_RESPONDENT_DID,
          escrow: {
            escrowAddress: "0x2222222222222222222222222222222222222222",
            operator: "0x3333333333333333333333333333333333333333",
            receiver: "0x4444444444444444444444444444444444444444",
            token: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
            capturedAmountMicroUsdc: 250_000_000,
            refundExpiry: 1_900_000_000,
            salt: "42",
            jobId: "job-sla-99",
          },
          contractHash: null,
          claimSummary: "Data pipeline missed 99.9% SLA",
          requestedRemedy: "Partial USDC refund + 2h hotfix",
          maxRefundMicroUsdc: 250_000_000,
          refundStepMicroUsdc: 1_000_000,
          includeRemediationHours: true,
          minAcceptableRefundMicroUsdc: 0,
          determinationConsent: false,
          requireDelivery: true,
        }),
      );
      expect(out.disputeId).toBe("dsp_0123456789abcdef0123456789abcdef");
      expect(out.contractHash).toMatch(/^[0-9a-f]{64}$/);
      expect(mockClient.fileDispute).toHaveBeenCalledTimes(1);
    });

    it("rejects filing when neither escrow nor contractHash is provided", async () => {
      const res = await provider.fileEscrowDispute(mockWallet, {
        respondentId: MOCK_RESPONDENT_DID,
        escrow: null,
        contractHash: null,
        claimSummary: "Missing binding",
        requestedRemedy: "Refund",
        maxRefundMicroUsdc: 100_000_000,
        refundStepMicroUsdc: 1_000_000,
        includeRemediationHours: false,
        minAcceptableRefundMicroUsdc: 0,
        determinationConsent: false,
        requireDelivery: false,
      });
      expect(res).toContain("provide either `escrow`");
      expect(mockClient.fileDispute).not.toHaveBeenCalled();
    });

    it("rejects filing when maxRefundMicroUsdc exceeds captured escrow amount", async () => {
      const res = await provider.fileEscrowDispute(mockWallet, {
        respondentId: MOCK_RESPONDENT_DID,
        escrow: {
          escrowAddress: "0x2222222222222222222222222222222222222222",
          operator: "0x3333333333333333333333333333333333333333",
          receiver: "0x4444444444444444444444444444444444444444",
          token: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
          capturedAmountMicroUsdc: 100_000_000,
          refundExpiry: 1_900_000_000,
          salt: "42",
          jobId: "job-sla-100",
        },
        contractHash: null,
        claimSummary: "Over-claim",
        requestedRemedy: "Refund",
        maxRefundMicroUsdc: 200_000_000,
        refundStepMicroUsdc: 1_000_000,
        includeRemediationHours: false,
        minAcceptableRefundMicroUsdc: 0,
        determinationConsent: false,
        requireDelivery: false,
      });
      expect(res).toContain("exceeds capturedAmountMicroUsdc");
      expect(mockClient.fileDispute).not.toHaveBeenCalled();
    });
  });

  describe("submitOffer", () => {
    it("returns structured PROPOSAL_DETAILS when submitting sealed offers", async () => {
      const out = JSON.parse(
        await provider.submitOffer({
          disputeId: "dsp_0123456789abcdef0123456789abcdef",
          round: 1,
          offer: { refundMicroUsdc: 120_000_000, remediationHours: 2 },
          weights: { refundMicroUsdc: 0.7, remediationHours: 0.3 },
          walkaway: { refundMicroUsdc: 50_000_000, remediationHours: 6 },
          limits: null,
          proposalResponse: null,
        }),
      );
      expect(out.PROPOSAL_DETAILS.kind).toBe("PLATFORM_PROPOSAL");
      expect(out.PROPOSAL_DETAILS.termsHash).toMatch(/^[0-9a-f]{64}$/);
      expect(out.PROPOSAL_DETAILS.withinYourMandate).toBe(true);
    });

    it("rejects mismatched weights and walkaway parameters", async () => {
      const res = await provider.submitOffer({
        disputeId: "dsp_0123456789abcdef0123456789abcdef",
        round: 1,
        offer: { refundMicroUsdc: 120_000_000 },
        weights: { refundMicroUsdc: 1 },
        walkaway: null,
        limits: null,
        proposalResponse: null,
      });
      expect(res).toContain("must both be provided together");
      expect(mockClient.submitOffer).not.toHaveBeenCalled();
    });
  });

  describe("verifyOutcome", () => {
    it("verifies signed settlement outcome and computes exact x402r escrow refund and release split", async () => {
      const out = JSON.parse(
        await provider.verifyOutcome({
          disputeId: "dsp_0123456789abcdef0123456789abcdef",
          expectedContractHash: "a".repeat(64),
          capturedAmountMicroUsdc: 250_000_000,
        }),
      );
      expect(out.verified).toBe(true);
      expect(out.escrowSplit).toEqual({
        refundMicroUsdc: 75_000_000,
        merchantReleaseMicroUsdc: 175_000_000,
      });
    });

    it("fails closed on contractHash mismatch during verifyOutcome", async () => {
      const res = await provider.verifyOutcome({
        disputeId: "dsp_0123456789abcdef0123456789abcdef",
        expectedContractHash: "b".repeat(64),
        capturedAmountMicroUsdc: 250_000_000,
      });
      expect(res).toContain("contractHash mismatch");
    });

    it("fails closed when settled refund exceeds captured escrow amount", async () => {
      const res = await provider.verifyOutcome({
        disputeId: "dsp_0123456789abcdef0123456789abcdef",
        expectedContractHash: "a".repeat(64),
        capturedAmountMicroUsdc: 50_000_000,
      });
      expect(res).toContain("exceeds capturedAmountMicroUsdc");
    });

    it("returns a formatted error when outcome verification fails", async () => {
      mockClient.outcome.mockRejectedValueOnce(new Error("Signature mismatch"));
      const res = await provider.verifyOutcome({
        disputeId: "dsp_0123456789abcdef0123456789abcdef",
        expectedContractHash: null,
        capturedAmountMicroUsdc: null,
      });
      expect(res).toContain("Error verifying Agent-Mediate outcome");
      expect(res).toContain("Signature mismatch");
    });
  });

  describe("constructor defaults", () => {
    it("initializes AgentMediateClient with pinned production defaults when no client is injected", () => {
      const { AgentMediateClient: MockClient } = jest.requireMock("@agent-mediate/sdk");
      const defaultProvider = agentMediateActionProvider();
      expect(defaultProvider.name).toBe("agentMediate");
      expect(MockClient).toHaveBeenCalledWith(
        expect.objectContaining({
          baseUrl: "https://api.ai-agents-mediation.com",
          platformDid: "did:key:z6Mkg7r4aHyPrNKYy1gbWGXu15VgyN9fCbhqKVwftdhHxJ3W",
          expectedRulesHash: MOCK_RULES_HASH,
        }),
      );
    });
  });
});
