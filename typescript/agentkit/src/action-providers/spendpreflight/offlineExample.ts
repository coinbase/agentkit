import { createPreflightReviewer } from "./preflight";

/**
 * Runs the default reviewer without registering a wallet, model or telemetry-producing action.
 *
 * @returns An offline hold and an explicit indication that no payment was attempted.
 */
export async function offlineExample() {
  const review = createPreflightReviewer();
  const decision = await review({
    challenge: { x402Version: 2, resource: { url: "https://merchant.example/data" }, accepts: [] },
    resource_url: "https://merchant.example/data",
  });
  // No signer or payment callback exists. This default cannot spend funds.
  return { ...decision, payment: "not_attempted" as const };
}
