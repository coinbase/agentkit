---
"@coinbase/agentkit": patch
---

Added the FractalAI receipts action provider (`fractalaiReceiptsActionProvider`) with two actions: `verify_x402_receipt`, which verifies post-quantum (ML-DSA-65) signed x402 receipts (the proposed `delivery-receipt` extension, and FractalAI notary seals, served proofs and MIDAS alerts) and reports integrity, authenticity, key trust, settlement and delivery separately; and `request_x402_receipt`, which pays the FractalAI notary 0.005 USDC on Base via x402 for an independent seal of an already-settled payment and verifies the seal. Added the `@noble/post-quantum` dependency.
