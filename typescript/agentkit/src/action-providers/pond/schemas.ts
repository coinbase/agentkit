import { z } from "zod";

/**
 * Schema for wallet summary from Pond
 */
export const WalletSummarySchema = {
  input: z
    .object({
      walletAddress: z
        .string()
        .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum wallet address format"),
      duration: z
        .number()
        .int()
        .min(1)
        .max(12)
        .refine(
          (val) => [1, 3, 6, 12].includes(val),
          "Duration must be 1, 3, 6, or 12 months"
        ),
      chain: z
        .enum(['BASE', 'ETH', 'SOLANA'])
        .optional()
        .describe("The blockchain to analyze. If not specified, you will be prompted to choose one."),
      query: z.string().optional().describe("Optional query string to determine if this is a token purchase query")
    })
    .strip()
    .describe("Instructions for getting wallet activity summary from Pond's analytics platform"),

  response: z.object({
    code: z.number(),
    msg: z.string(),
    resp_type: z.union([z.string(), z.number()]),
    data: z.array(
      z.object({
        input_key: z.string(),
        score: z.number().nullable(),
        analysis_result: z.record(z.any()),
        debug_info: z.object({
          UPDATED_AT: z.union([z.string(), z.number()]),
        }),
      })
    ).optional(),
    resp_items: z.array(
      z.object({
        input_key: z.string(),
        score: z.number().nullable(),
        analysis_result: z.record(z.any()),
        debug_info: z.object({
          UPDATED_AT: z.union([z.string(), z.number()]),
        }),
      })
    ).optional(),
  }).refine(
    (data) => data.data !== undefined || data.resp_items !== undefined,
    {
      message: "Either data or resp_items must be present in Pond's response",
    }
  ).describe("Response schema for Pond's wallet activity summary")
};

/**
 * Schema for wallet risk score from Pond
 */
export const WalletRiskScoreSchema = {
  input: z
    .object({
      walletAddress: z
        .string()
        .regex(/^0x[a-fA-F0-9]{40}$/)
        .describe("The Ethereum wallet address to analyze for risk using Pond's risk model"),
      model: z
        .enum(['DEFAULT', 'BASE_22JE0569', 'BASE_WELLSPRING'])
        .optional()
        .describe("The risk assessment model to use. If not specified, the default model will be used."),
    })
    .strip()
    .describe("Instructions for getting wallet risk score from Pond's risk assessment model"),

  response: z.object({
    code: z.number(),
    msg: z.string().optional(),
    resp_type: z.number().optional(),
    data: z.array(
      z.object({
        input_key: z.string(),
        score: z.number(),
        debug_info: z.object({
          feature_update_time: z.record(z.string()).optional(),
          not_null_feature: z.string().optional(),
        }).optional(),
      })
    ).optional(),
    resp_items: z.array(
      z.object({
        input_key: z.string(),
        score: z.number(),
        debug_info: z.object({
          feature_update_time: z.record(z.string()).optional(),
          not_null_feature: z.string().optional(),
        }).optional(),
      })
    ).optional(),
  }).refine(
    (data) => data.data !== undefined || data.resp_items !== undefined,
    {
      message: "Either data or resp_items must be present in Pond's response",
    }
  ).describe("Response schema for Pond's wallet risk assessment model")
};

/**
 * Schema for Sybil prediction from Pond
 */
export const SybilPredictionSchema = {
  input: z
    .object({
      walletAddress: z
        .string()
        .regex(/^0x[a-fA-F0-9]{40}$/, 'Must be a valid Ethereum address')
        .describe("The Ethereum wallet address to analyze using Pond's Sybil detection model"),
    })
    .strip()
    .describe("Instructions for getting Sybil prediction from Pond's Sybil detection model"),

  response: z.object({
    code: z.number(),
    msg: z.string().optional(),
    resp_type: z.number().optional(),
    data: z.array(
      z.object({
        input_key: z.string(),
        score: z.number(),
        debug_info: z.object({
          feature_update_time: z.record(z.string()),
          not_null_feature: z.string()
        }),
      })
    ).optional(),
    resp_items: z.array(
      z.object({
        input_key: z.string(),
        score: z.number(),
        debug_info: z.object({
          feature_update_time: z.record(z.string()),
          not_null_feature: z.string()
        }),
      })
    ).optional(),
  }).refine(
    (data) => data.data !== undefined || data.resp_items !== undefined,
    {
      message: "Either data or resp_items must be present in Pond's Sybil detection response",
    }
  ).describe("Response schema for Pond's Sybil detection model")
};

/**
 * Schema for token price prediction from Pond
 */
export const TokenPricePredictionSchema = {
  input: z
    .object({
      tokenAddress: z
        .string()
        .regex(/^0x[a-fA-F0-9]{40}$/)
        .describe("The Base chain token address to analyze using Pond's price prediction model"),
      timeframe: z
        .number()
        .refine((val) => [1, 3, 6, 12, 24].includes(val), {
          message: "Timeframe must be 1, 3, 6, 12, or 24 hours",
        })
        .describe("Prediction timeframe in hours for Pond's price forecast (1, 3, 6, 12, or 24)"),
    })
    .strip()
    .describe("Instructions for getting token price prediction from Pond's price prediction model"),

  response: z.object({
    code: z.number(),
    msg: z.string().optional(),
    resp_type: z.number().optional(),
    data: z.array(
      z.object({
        input_key: z.string(),
        score: z.number(),
        debug_info: z.object({
          feature_update_time: z.record(z.string()),
          not_null_feature: z.string()
        }),
      })
    ).optional(),
    resp_items: z.array(
      z.object({
        input_key: z.string(),
        score: z.number(),
        debug_info: z.object({
          feature_update_time: z.record(z.string()),
          not_null_feature: z.string()
        }),
      })
    ).optional(),
  }).refine(
    (data) => data.data !== undefined || data.resp_items !== undefined,
    {
      message: "Either data or resp_items must be present in Pond's price prediction response",
    }
  ).describe("Response schema for Pond's token price prediction model")
};

/**
 * Schema for token risk scoring from Pond
 */
export const TokenRiskScoreSchema = {
  input: z.object({
    tokenAddress: z
      .string()
      .regex(/^0x[a-fA-F0-9]{40}$/)
      .describe("The Base chain token contract address to analyze"),
  }).strip().describe("Instructions for getting token risk scores from Pond's risk assessment models"),

  response: z.object({
    code: z.number(),
    msg: z.string().optional(),
    resp_type: z.number().optional(),
    data: z.array(
      z.object({
        input_key: z.string(),
        score: z.number(),
        debug_info: z.object({
          feature_update_time: z.record(z.string()),
          not_null_feature: z.string(),
          UPDATED_AT: z.string().optional()
        }),
      })
    ).optional(),
    resp_items: z.array(
      z.object({
        input_key: z.string(),
        score: z.number(),
        debug_info: z.object({
          feature_update_time: z.record(z.string()),
          not_null_feature: z.string(),
          UPDATED_AT: z.string().optional()
        }),
      })
    ).optional(),
  }).refine(
    (data) => data.data !== undefined || data.resp_items !== undefined,
    {
      message: "Either data or resp_items must be present in Pond's response",
    }
  ).describe("Response schema for Pond's token risk scoring models")
};

/**
 * Schema for top 10 Solana meme coins from Pond
 */
export const TopSolanaMemeCoinsSchema = {
  input: z.object({
    timeframe: z.number(),
    addresses: z.array(z.string()).default(["LZboYF8CPRYiswZFLSQusXEaMMwMxuSA5VtjGPtpump"]).optional(),
  }),
  response: z.object({
    code: z.number(),
    message: z.string().optional(),
    msg: z.string().optional(),
    resp_type: z.union([z.string(), z.number()]),
    data: z.array(z.object({
      input_key: z.string(),
      score: z.number().nullable().optional(),
      analysis_result: z.record(z.any()),
      debug_info: z.object({
        UPDATED_AT: z.union([z.string(), z.number()]),
        not_null_feature: z.union([z.string(), z.number()]).optional(),
        feature_update_time: z.record(z.any()).optional(),
      }),
    })).optional(),
    resp_items: z.array(z.object({
      input_key: z.string(),
      score: z.number().nullable().optional(),
      analysis_result: z.record(z.any()),
      debug_info: z.object({
        UPDATED_AT: z.union([z.string(), z.number()]),
        not_null_feature: z.union([z.string(), z.number()]).optional(),
        feature_update_time: z.record(z.any()).optional(),
      }),
    })).optional(),
  })
  .refine(
    (data) => data.data || data.resp_items,
    "Either data or resp_items must be present in Pond's response"
  )
  .transform((obj) => ({
    ...obj,
    message: obj.message || obj.msg || ""
  })),
};

/**
 * Schema for Base data analyst from Pond
 */
export const BaseDataAnalystSchema = {
  input: z.object({
    query: z.string().describe("The query to analyze using Pond's Base data analyst model"),
  }).strip().describe("Instructions for getting Base chain data analysis from Pond's data analyst model"),

  response: z.object({
    code: z.number(),
    msg: z.string().optional(),
    resp_type: z.union([z.string(), z.number()]),
    data: z.array(
      z.object({
        input_key: z.string(),
        score: z.number().nullable().optional(),
        analysis_result: z.record(z.any()),
        debug_info: z.object({
          UPDATED_AT: z.union([z.string(), z.number()]),
          not_null_feature: z.union([z.string(), z.number()]).optional(),
          feature_update_time: z.record(z.any()).optional(),
        }),
      })
    ).optional(),
    resp_items: z.array(
      z.object({
        input_key: z.string(),
        score: z.number().nullable().optional(),
        analysis_result: z.record(z.any()),
        debug_info: z.object({
          UPDATED_AT: z.union([z.string(), z.number()]),
          not_null_feature: z.union([z.string(), z.number()]).optional(),
          feature_update_time: z.record(z.any()).optional(),
        }),
      })
    ).optional(),
  }).refine(
    (data) => data.data !== undefined || data.resp_items !== undefined,
    {
      message: "Either data or resp_items must be present in Pond's response",
    }
  ).describe("Response schema for Pond's Base data analyst model")
};

/**
 * Schema for Ethereum data analyst from Pond
 */
export const EthereumDataAnalystSchema = {
  input: z.object({
    query: z.string().describe("The query to analyze using Pond's Ethereum data analyst model"),
  }).strip().describe("Instructions for getting Ethereum chain data analysis from Pond's data analyst model"),

  response: z.object({
    code: z.number(),
    msg: z.string().optional(),
    resp_type: z.union([z.string(), z.number()]),
    data: z.array(
      z.object({
        input_key: z.string(),
        score: z.number().nullable().optional(),
        analysis_result: z.record(z.any()),
        debug_info: z.object({
          UPDATED_AT: z.union([z.string(), z.number()]),
          not_null_feature: z.union([z.string(), z.number()]).optional(),
          feature_update_time: z.record(z.any()).optional(),
        }),
      })
    ).optional(),
    resp_items: z.array(
      z.object({
        input_key: z.string(),
        score: z.number().nullable().optional(),
        analysis_result: z.record(z.any()),
        debug_info: z.object({
          UPDATED_AT: z.union([z.string(), z.number()]),
          not_null_feature: z.union([z.string(), z.number()]).optional(),
          feature_update_time: z.record(z.any()).optional(),
        }),
      })
    ).optional(),
  }).refine(
    (data) => data.data !== undefined || data.resp_items !== undefined,
    {
      message: "Either data or resp_items must be present in Pond's response",
    }
  ).describe("Response schema for Pond's Ethereum data analyst model")
};

/**
 * Schema for PumpFun price prediction from Pond
 */
export const PumpFunPricePredictionSchema = {
  input: z
    .object({
      tokenAddress: z
        .string()
        .min(32)
        .max(44)
        .describe("The Solana token address to analyze using Pond's PumpFun price prediction model"),
      timeframe: z
        .number()
        .refine((val) => [1, 3, 6, 12, 24].includes(val), {
          message: "Timeframe must be 1, 3, 6, 12, or 24 hours",
        })
        .describe("Prediction timeframe in hours for Pond's price forecast (1, 3, 6, 12, or 24)"),
    })
    .strip()
    .describe("Instructions for getting PumpFun price prediction from Pond's price prediction model"),

  response: z.object({
    code: z.number(),
    msg: z.string().optional(),
    resp_type: z.number().optional(),
    data: z.array(
      z.object({
        input_key: z.string(),
        score: z.number(),
        debug_info: z.object({
          feature_update_time: z.record(z.string()),
          not_null_feature: z.string()
        }),
      })
    ).optional(),
    resp_items: z.array(
      z.object({
        input_key: z.string(),
        score: z.number(),
        debug_info: z.object({
          feature_update_time: z.record(z.string()),
          not_null_feature: z.string()
        }),
      })
    ).optional(),
  }).refine(
    (data) => data.data !== undefined || data.resp_items !== undefined,
    {
      message: "Either data or resp_items must be present in Pond's price prediction response",
    }
  ).describe("Response schema for Pond's PumpFun price prediction model")
};

/**
 * Schema for Zora NFT recommendations from Pond
 */
export const ZoraNFTRecommendationSchema = {
  input: z
    .object({
      walletAddress: z
        .string()
        .regex(/^0x[a-fA-F0-9]{40}$/)
        .describe("The Ethereum wallet address to get NFT recommendations for"),
    })
    .strip()
    .describe("Instructions for getting Zora NFT recommendations from Pond's recommendation model"),

  response: z.object({
    code: z.number(),
    msg: z.string().optional(),
    resp_type: z.number().optional(),
    data: z.array(
      z.object({
        input_key: z.string(),
        score: z.number().nullable(),
        candidates: z.array(
          z.object({
            item_id: z.string(),
            score: z.number()
          })
        ),
        debug_info: z.object({
          feature_update_time: z.record(z.string()),
          not_null_feature: z.string()
        }),
      })
    ).optional(),
    resp_items: z.array(
      z.object({
        input_key: z.string(),
        score: z.number().nullable(),
        candidates: z.array(
          z.object({
            item_id: z.string(),
            score: z.number()
          })
        ),
        debug_info: z.object({
          feature_update_time: z.record(z.string()),
          not_null_feature: z.string()
        }),
      })
    ).optional(),
  }).refine(
    (data) => data.data !== undefined || data.resp_items !== undefined,
    {
      message: "Either data or resp_items must be present in Pond's response",
    }
  ).describe("Response schema for Pond's Zora NFT recommendation model")
};

/**
 * Schema for security model from Pond
 */
export const SecurityModelSchema = {
  input: z
    .object({
      address: z
        .string()
        .regex(/^0x[a-fA-F0-9]{40}$/)
        .describe("The Ethereum address to analyze for security risks"),
    })
    .strip()
    .describe("Instructions for getting security assessment from Pond's security model"),

  response: z.object({
    code: z.number(),
    msg: z.string().optional(),
    resp_type: z.number().optional(),
    data: z.array(
      z.object({
        input_key: z.string(),
        score: z.number(),
        debug_info: z.object({
          feature_update_time: z.record(z.string()),
          not_null_feature: z.string()
        }),
      })
    ).optional(),
    resp_items: z.array(
      z.object({
        input_key: z.string(),
        score: z.number(),
        debug_info: z.object({
          feature_update_time: z.record(z.string()),
          not_null_feature: z.string()
        }),
      })
    ).optional(),
  }).refine(
    (data) => data.data !== undefined || data.resp_items !== undefined,
    {
      message: "Either data or resp_items must be present in Pond's response",
    }
  ).describe("Response schema for Pond's security assessment model")
}; 