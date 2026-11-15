// SPDX-License-Identifier: Apache-2.0
// Generated from the implemented v8.0 enabled-preview inventory; static schemas, no remote registration.
export const DEFINITIONS = [
  {
    name: "otc_quote",
    description:
      "Read and validate agreed OTC parties/amounts on Robinhood Chain; calculate fee tier and a short-lived planning quote. The user reviews the agreed terms before signing.",
    inputSchema: {
      type: "object",
      properties: {
        chain: {
          type: "string",
          enum: ["4663"],
        },
        buyer: {
          type: "string",
          pattern: "^0x[0-9a-fA-F]{40}$",
        },
        seller: {
          type: "string",
          pattern: "^0x[0-9a-fA-F]{40}$",
        },
        token: {
          type: "string",
          pattern: "^0x[0-9a-fA-F]{40}$",
        },
        amount: {
          type: "string",
        },
        payAsset: {
          type: "string",
          description: "ETH, WETH, USDG or that fixed payment-token address",
        },
        payAmount: {
          type: "string",
        },
        expiry: {
          type: "integer",
        },
      },
      required: ["buyer", "seller", "token", "amount", "payAsset", "payAmount", "expiry"],
      additionalProperties: false,
    },
  },
  {
    name: "otc_create",
    description:
      "Prepare simulated unsigned createDeal transactions from an otc_quote result. Only buyer signs. fundNow defaults false; actual receipt determines dealId. Confirm approvals then re-prepare when required.",
    inputSchema: {
      type: "object",
      properties: {
        chain: {
          type: "string",
          enum: ["4663"],
        },
        actor: {
          type: "string",
          pattern: "^0x[0-9a-fA-F]{40}$",
        },
        quote: {
          type: "object",
        },
        fundNow: {
          type: "boolean",
        },
        dryRun: {
          type: "boolean",
        },
      },
      required: ["actor", "quote"],
      additionalProperties: false,
    },
  },
  {
    name: "otc_accept",
    description:
      "Read an actual deal and prepare the named buyer/seller deposit. Requires the termsHash from a recent deal_status. Exact token approvals; no key/sign/send. Never infers a dealId.",
    inputSchema: {
      type: "object",
      properties: {
        chain: {
          type: "string",
          enum: ["4663"],
        },
        dealId: {
          type: "string",
          pattern: "^[1-9][0-9]*$",
        },
        actor: {
          type: "string",
          pattern: "^0x[0-9a-fA-F]{40}$",
        },
        expectedTermsHash: {
          type: "string",
          pattern: "^0x[0-9a-fA-F]{64}$",
        },
        payout: {
          type: "string",
          pattern: "^0x[0-9a-fA-F]{40}$",
        },
        dryRun: {
          type: "boolean",
        },
      },
      required: ["dealId", "actor", "expectedTermsHash"],
      additionalProperties: false,
    },
  },
  {
    name: "deal_status",
    description:
      "Read an actual QOtcEscrow deal, immutable terms hash, funding state, claimable balances and simulated user refund/cancel/withdraw actions.",
    inputSchema: {
      type: "object",
      properties: {
        chain: {
          type: "string",
          enum: ["4663"],
        },
        dealId: {
          type: "string",
          pattern: "^[1-9][0-9]*$",
        },
        actor: {
          type: "string",
          pattern: "^0x[0-9a-fA-F]{40}$",
        },
      },
      required: ["dealId"],
      additionalProperties: false,
    },
  },
  {
    name: "agreement_create",
    description:
      "Prepare simulated unsigned create/fund transactions for explicit conditions; the payer wallet signs. Exact decimal amounts, chain-time validation, fee 0.5% on released tranches. Approval may be staged.",
    inputSchema: {
      type: "object",
      properties: {
        chain: {
          type: "string",
          enum: ["4663"],
        },
        payer: {
          type: "string",
          pattern: "^0x[0-9a-fA-F]{40}$",
        },
        payee: {
          type: "string",
          pattern: "^0x[0-9a-fA-F]{40}$",
        },
        asset: {
          type: "string",
        },
        expiry: {
          type: "integer",
        },
        expiresInDays: {
          type: "integer",
          minimum: 1,
          maximum: 365,
        },
        terms: {
          type: "string",
          maxLength: 4096,
        },
        dryRun: {
          type: "boolean",
        },
        tranches: {
          type: "array",
          items: {
            type: "object",
            properties: {
              amount: {
                type: "string",
              },
              conditions: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    kind: {
                      type: "integer",
                      enum: [1, 2, 3, 6],
                    },
                    k: {
                      type: "integer",
                      minimum: 0,
                      maximum: 9,
                    },
                    value: {
                      type: "integer",
                      minimum: 0,
                    },
                    parties: {
                      type: "array",
                      items: {
                        type: "string",
                        pattern: "^0x[0-9a-fA-F]{40}$",
                      },
                      maxItems: 9,
                      minItems: 0,
                    },
                  },
                  required: ["kind"],
                  additionalProperties: false,
                },
                maxItems: 8,
                minItems: 1,
              },
            },
            required: ["amount", "conditions"],
            additionalProperties: false,
          },
          maxItems: 10,
          minItems: 1,
        },
      },
      required: ["payer", "payee", "asset", "tranches"],
      additionalProperties: false,
    },
  },
  {
    name: "agreement_fund",
    description:
      "Prepare atomic creation and funding from the full agreement specification. Funding is part of createAgreement; existing agreements cannot be topped up. User signs exact approval/create transactions.",
    inputSchema: {
      type: "object",
      properties: {
        chain: {
          type: "string",
          enum: ["4663"],
        },
        payer: {
          type: "string",
          pattern: "^0x[0-9a-fA-F]{40}$",
        },
        payee: {
          type: "string",
          pattern: "^0x[0-9a-fA-F]{40}$",
        },
        asset: {
          type: "string",
        },
        expiry: {
          type: "integer",
        },
        expiresInDays: {
          type: "integer",
          minimum: 1,
          maximum: 365,
        },
        terms: {
          type: "string",
          maxLength: 4096,
        },
        dryRun: {
          type: "boolean",
        },
        tranches: {
          type: "array",
          items: {
            type: "object",
            properties: {
              amount: {
                type: "string",
              },
              conditions: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    kind: {
                      type: "integer",
                      enum: [1, 2, 3, 6],
                    },
                    k: {
                      type: "integer",
                      minimum: 0,
                      maximum: 9,
                    },
                    value: {
                      type: "integer",
                      minimum: 0,
                    },
                    parties: {
                      type: "array",
                      items: {
                        type: "string",
                        pattern: "^0x[0-9a-fA-F]{40}$",
                      },
                      maxItems: 9,
                      minItems: 0,
                    },
                  },
                  required: ["kind"],
                  additionalProperties: false,
                },
                maxItems: 8,
                minItems: 1,
              },
            },
            required: ["amount", "conditions"],
            additionalProperties: false,
          },
          maxItems: 10,
          minItems: 1,
        },
      },
      required: ["payer", "payee", "asset", "tranches"],
      additionalProperties: false,
    },
  },
  {
    name: "agreement_from_template",
    description:
      "Prepare an agreement from milestones, arbiter_escrow, time_release, optimistic or panel. No price-trigger template. Never signs or sends.",
    inputSchema: {
      type: "object",
      properties: {
        chain: {
          type: "string",
          enum: ["4663"],
        },
        payer: {
          type: "string",
          pattern: "^0x[0-9a-fA-F]{40}$",
        },
        payee: {
          type: "string",
          pattern: "^0x[0-9a-fA-F]{40}$",
        },
        asset: {
          type: "string",
        },
        expiry: {
          type: "integer",
        },
        expiresInDays: {
          type: "integer",
          minimum: 1,
          maximum: 365,
        },
        terms: {
          type: "string",
          maxLength: 4096,
        },
        dryRun: {
          type: "boolean",
        },
        template: {
          type: "string",
          enum: ["milestones", "arbiter_escrow", "time_release", "optimistic", "panel"],
        },
        params: {
          type: "object",
        },
      },
      required: ["payer", "payee", "asset", "template", "params"],
      additionalProperties: false,
    },
  },
  {
    name: "agreement_status",
    description:
      "Read actual contract parties, tranches, conditions, chain-time readiness and consent nonce. Optional actor includes vote checks and simulated party actions.",
    inputSchema: {
      type: "object",
      properties: {
        chain: {
          type: "string",
          enum: ["4663"],
        },
        id: {
          type: "string",
          pattern: "^[1-9][0-9]*$",
        },
        actor: {
          type: "string",
          pattern: "^0x[0-9a-fA-F]{40}$",
        },
      },
      required: ["id"],
      additionalProperties: false,
    },
  },
  {
    name: "agreement_release",
    description:
      "Read actual tranche readiness and prepare an unsigned permissionless release. User wallet signs. No payout promise or automatic broadcast.",
    inputSchema: {
      type: "object",
      properties: {
        chain: {
          type: "string",
          enum: ["4663"],
        },
        id: {
          type: "string",
          pattern: "^[1-9][0-9]*$",
        },
        actor: {
          type: "string",
          pattern: "^0x[0-9a-fA-F]{40}$",
        },
        tranche: {
          type: "integer",
          minimum: 0,
          maximum: 9,
        },
        dryRun: {
          type: "boolean",
        },
      },
      required: ["id", "actor"],
      additionalProperties: false,
    },
  },
  {
    name: "agreement_refund",
    description:
      "Prepare an unsigned refund only when chain state permits it after expiry and release grace. User wallet signs; no automatic transfer is claimed.",
    inputSchema: {
      type: "object",
      properties: {
        chain: {
          type: "string",
          enum: ["4663"],
        },
        id: {
          type: "string",
          pattern: "^[1-9][0-9]*$",
        },
        actor: {
          type: "string",
          pattern: "^0x[0-9a-fA-F]{40}$",
        },
        dryRun: {
          type: "boolean",
        },
      },
      required: ["id", "actor"],
      additionalProperties: false,
    },
  },
  {
    name: "agreement_attest",
    description:
      "Return a simulated unsigned attest only for a named ATTEST/QUORUM wallet with an uncounted vote. User wallet signs.",
    inputSchema: {
      type: "object",
      properties: {
        chain: {
          type: "string",
          enum: ["4663"],
        },
        id: {
          type: "string",
          pattern: "^[1-9][0-9]*$",
        },
        actor: {
          type: "string",
          pattern: "^0x[0-9a-fA-F]{40}$",
        },
        tranche: {
          type: "integer",
          minimum: 0,
          maximum: 9,
        },
        dryRun: {
          type: "boolean",
        },
      },
      required: ["id", "actor"],
      additionalProperties: false,
    },
  },
  {
    name: "qproof_check",
    description:
      "Read the latest stored QProof verdict and checks for an exact token. Cache-first; never runs code or starts a check.",
    inputSchema: {
      type: "object",
      properties: {
        chain: {
          type: "string",
        },
        token: {
          type: "string",
          minLength: 1,
          maxLength: 44,
        },
      },
      required: ["chain", "token"],
      additionalProperties: false,
    },
  },
  {
    name: "wallet_portfolio",
    description:
      "Read the same cached portfolio report used by QHooks. A cold or expired cache returns unavailable; this tool never refreshes paid providers. Cost and PnL remain qualified data from the report.",
    inputSchema: {
      type: "object",
      properties: {
        address: {
          type: "string",
          minLength: 1,
          maxLength: 44,
        },
      },
      required: ["address"],
      additionalProperties: false,
    },
  },
  {
    name: "hooks_catalog",
    description:
      "Search the existing hook snapshot and listed builder modules. Source dates and unknown builder cuts stay explicit; bounded cached QProof links never start checks.",
    inputSchema: {
      type: "object",
      properties: {
        search: {
          type: "string",
          maxLength: 100,
        },
      },
      required: [],
      additionalProperties: false,
    },
  },
  {
    name: "agent_stats",
    description:
      "Read a bounded window of stored final referral credits by asset. Coverage is partial; routed volume, USD earnings and claimable balances remain unknown. Never refreshes rewards providers.",
    inputSchema: {
      type: "object",
      properties: {
        referrer: {
          type: "string",
          pattern: "^0x[0-9a-fA-F]{40}$",
        },
      },
      required: ["referrer"],
      additionalProperties: false,
    },
  },
  {
    name: "list_callers",
    description:
      "Read the existing public caller-price method from stored records. Rank only complete eligible observations; no token-feed callout, wallet PnL or independence claim is inferred.",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
      additionalProperties: false,
    },
  },
  {
    name: "caller_record",
    description:
      "Read bounded public scored-call records for an exact EVM wallet, retaining quote units, hidden-text rules and incomplete coverage. Never refreshes prices.",
    inputSchema: {
      type: "object",
      properties: {
        address: {
          type: "string",
          pattern: "^0x[0-9a-fA-F]{40}$",
        },
      },
      required: ["address"],
      additionalProperties: false,
    },
  },
  {
    name: "perps_markets",
    description:
      "Read Hyperliquid native perpetual markets, mark prices and funding. Bounded public info read; short cache, no orders or signing.",
    inputSchema: {
      type: "object",
      properties: {
        coin: {
          type: "string",
          pattern: "^[A-Za-z0-9._-]{1,32}$",
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: "perps_positions",
    description:
      "Read public Hyperliquid positions and unrealized PnL for an address. Short cache; realized/lifetime PnL remains unknown.",
    inputSchema: {
      type: "object",
      properties: {
        address: {
          type: "string",
          pattern: "^0x[0-9a-fA-F]{40}$",
        },
      },
      required: ["address"],
      additionalProperties: false,
    },
  },
  {
    name: "prepare_perps_order",
    description:
      "Prepare one unsigned Hyperliquid native perpetual limit/IOC order or first-time 0.1% builder-fee approval for the USER main wallet. Does not sign, submit, change leverage or create an API wallet. Requires configured QHooks builder and an allowed edge region.",
    inputSchema: {
      type: "object",
      properties: {
        address: {
          type: "string",
          pattern: "^0x[0-9a-fA-F]{40}$",
        },
        coin: {
          type: "string",
          pattern: "^[A-Za-z0-9._-]{1,32}$",
        },
        side: {
          type: "string",
          enum: ["buy", "sell"],
        },
        size: {
          type: "string",
          pattern: "^(?:0|[1-9][0-9]{0,17})(?:\\.[0-9]{1,18})?$",
          description: "Exact base-coin size; never USDC notional.",
        },
        limitPrice: {
          type: "string",
          pattern: "^(?:0|[1-9][0-9]{0,17})(?:\\.[0-9]{1,18})?$",
          description:
            "Explicit price bound in USD. IOC can partly fill or cancel; never an unbounded market order.",
        },
        timeInForce: {
          type: "string",
          enum: ["Ioc", "Gtc", "Alo"],
        },
        reduceOnly: {
          type: "boolean",
        },
        nonce: {
          type: "integer",
          minimum: 1,
          maximum: 9007199254740991,
          description:
            "Fresh millisecond nonce allocated by the user wallet; coordinate with its other Hyperliquid actions.",
        },
      },
      required: ["address", "coin", "side", "size", "limitPrice", "timeInForce", "nonce"],
      additionalProperties: false,
    },
  },
  {
    name: "list_launches",
    description: "Read recent QHooks launches. Missing something? Call send_feedback.",
    inputSchema: {
      type: "object",
      properties: {
        chain: {
          type: "string",
          description: "Chain id, key or name from the QHooks chain registry.",
        },
        limit: {
          type: "integer",
          minimum: 1,
          maximum: 100,
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: "token_info",
    description: "Read a token market on QHooks. Missing something? Call send_feedback.",
    inputSchema: {
      type: "object",
      properties: {
        chain: {
          type: "string",
          description: "Chain id, key or name from the QHooks chain registry.",
        },
        token: {
          type: "string",
          pattern: "^0x[0-9a-fA-F]{40}$",
        },
      },
      required: ["chain", "token"],
      additionalProperties: false,
    },
  },
  {
    name: "quote",
    description:
      "Simulate an exact-input pool swap with the existing V4Quoter API. Missing something? Call send_feedback.",
    inputSchema: {
      type: "object",
      properties: {
        chain: {
          type: "string",
          description: "Chain id, key or name from the QHooks chain registry.",
        },
        pool: {
          type: "string",
          pattern: "^0x[0-9a-fA-F]{64}$",
        },
        zeroForOne: {
          type: "boolean",
        },
        amountIn: {
          type: "string",
          pattern: "^[1-9][0-9]{0,37}$",
          description:
            "Amount in raw currency units. Buys use the pool quote currency; sells use the token.",
        },
        trader: {
          type: "string",
          pattern: "^0x[0-9a-fA-F]{40}$",
        },
      },
      required: ["chain", "pool", "zeroForOne", "amountIn"],
      additionalProperties: false,
    },
  },
  {
    name: "prepare_launch",
    description:
      "Prepare a launch link for review and wallet signing on qhooks.com. Missing something? Call send_feedback.",
    inputSchema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          minLength: 1,
          maxLength: 32,
        },
        ticker: {
          type: "string",
          pattern: "^[A-Za-z0-9]{1,10}$",
        },
        chain: {
          type: "string",
          description: "Chain id, key or name from the QHooks chain registry.",
        },
        style: {
          type: "string",
        },
        referrer: {
          type: "string",
          pattern: "^0x[0-9a-fA-F]{40}$",
        },
      },
      required: ["name", "ticker"],
      additionalProperties: false,
    },
  },
  {
    name: "prepare_trade",
    description:
      "Prepare ordered unsigned approvals and a QHooks fee-router swap for the user wallet. Missing something? Call send_feedback.",
    inputSchema: {
      type: "object",
      properties: {
        chain: {
          type: "string",
          description: "Chain id, key or name from the QHooks chain registry.",
        },
        token: {
          type: "string",
          pattern: "^0x[0-9a-fA-F]{40}$",
        },
        side: {
          type: "string",
          enum: ["buy", "sell"],
        },
        amountIn: {
          type: "string",
          pattern: "^[1-9][0-9]{0,37}$",
          description:
            "Amount in raw currency units. Buys use the pool quote currency; sells use the token.",
        },
        slippageBps: {
          type: "integer",
          minimum: 0,
          maximum: 9999,
        },
        trader: {
          type: "string",
          pattern: "^0x[0-9a-fA-F]{40}$",
        },
        referrer: {
          type: "string",
          pattern: "^0x[0-9a-fA-F]{40}$",
        },
      },
      required: ["chain", "token", "side", "amountIn", "trader"],
      additionalProperties: false,
    },
  },
] as const;
export type ToolName = (typeof DEFINITIONS)[number]["name"];
