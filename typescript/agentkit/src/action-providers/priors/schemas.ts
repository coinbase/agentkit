import { z } from "zod";

const agentId = z
  .number()
  .int()
  .positive()
  .describe("The ERC-8004 agent id on Robinhood Chain, e.g. 1234");

export const GetAgentRecordSchema = z
  .object({ agentId })
  .describe("Read an agent's Priors repayment record before paying or hiring it");

export const GetCreditLineSchema = z
  .object({ agentId })
  .describe(
    "Read an agent's Priors credit line: its size, what is drawn and available, its open loans",
  );

export const BorrowSchema = z
  .object({
    agentId,
    amount: z.string().describe("Amount of USDG to borrow in human-readable format, e.g. 1.5"),
    days: z.number().int().positive().max(90).default(7).describe("Loan term in days (default 7)"),
  })
  .describe("Borrow USDG from the agent's Priors credit line into this wallet");

export const RepaySchema = z
  .object({
    loanId: z.number().int().positive().describe("The Priors loan id to repay, e.g. 50900"),
    agentId: agentId
      .optional()
      .describe("The agent whose loan it is (optional): a loan of another agent is refused"),
  })
  .describe("Repay a Priors loan in full (principal and fee) from this wallet");

export const PayX402WithCreditSchema = z
  .object({
    url: z.url().describe("The https URL that answers HTTP 402 (x402)"),
    agentId,
    maxPrice: z.string().describe("Most to pay for this call, in USDG, e.g. 0.10"),
    maxBorrow: z
      .string()
      .optional()
      .describe(
        "Most to borrow from the Priors line if the wallet is short, in USDG; 0 never borrows. Default 0, or, when the provider was given autoBorrow, its amount per call (a value here can only lower it)",
      ),
    days: z
      .number()
      .int()
      .positive()
      .max(90)
      .optional()
      .describe(
        "Term of a loan taken for the gap (default 7, or 14 with the provider's autoBorrow)",
      ),
    method: z
      .enum(["GET", "POST"])
      .optional()
      .describe("HTTP method (default GET, or POST when a body is given)"),
    body: z
      .string()
      .max(100_000)
      .optional()
      .describe(
        "Request body, e.g. an OpenAI-style chat completion request as JSON; sent as application/json when it parses",
      ),
  })
  .describe(
    "Pay an x402 URL in USDG on Robinhood Chain, borrowing the gap from the Priors line if needed",
  );
