import { x402Client } from "@x402/fetch";
import { ExactNearScheme } from "@x402/near/exact/client";
import type { ClientNearSigner } from "@x402/near";

describe("x402 NEAR version compatibility", () => {
  it("creates a NEAR v2 payload with the AgentKit x402 client", async () => {
    const signer: ClientNearSigner = {
      createSignedDelegateAction: jest.fn().mockResolvedValue("signed-delegate-action"),
    };
    const client = new x402Client();
    client.register("near:*", new ExactNearScheme(signer));

    const paymentRequirements = {
      scheme: "exact",
      network: "near:testnet" as const,
      asset: "usdc.testnet",
      amount: "1000",
      payTo: "merchant.testnet",
      maxTimeoutSeconds: 60,
      extra: {},
    };

    const payload = await client.createPaymentPayload({
      x402Version: 2,
      resource: {
        url: "https://example.com/paid",
        description: "Compatibility test",
        mimeType: "application/json",
      },
      accepts: [paymentRequirements],
    });

    expect(payload).toEqual({
      x402Version: 2,
      resource: {
        url: "https://example.com/paid",
        description: "Compatibility test",
        mimeType: "application/json",
      },
      accepted: paymentRequirements,
      payload: { signedDelegateAction: "signed-delegate-action" },
    });
    expect(signer.createSignedDelegateAction).toHaveBeenCalledWith({
      x402Version: 2,
      paymentRequirements,
    });
  });
});
