import { z } from "zod"
import type { FlippandoAction, FlippandoActionSchemaAny } from "./actions/flippando"
import { ethers } from "ethers"

interface FlippandoAgentkitOptions {
  cdpApiKeyName?: string
  cdpApiKeyPrivateKey?: string
  providerUrl?: string
  privateKey?: string
  flippandoGameMasterAddress?: string
  flippandoAddress?: string
  flippandoBundlerAddress?: string
  flipndAddress?: string
  chainId?: number
  twitterApiKey?: string
  twitterApiSecret?: string
  twitterAccessToken?: string
  twitterAccessSecret?: string
}

export const FlippandoAgentkitOptions = z
  .object({
    cdpApiKeyName: z.string().min(1, "The Cdp API key name is required").describe("The Cdp API key name"),
    cdpApiKeyPrivateKey: z.string().min(1, "The Cdp private key is required").describe("The Cdp API private key"),
    providerUrl: z.string().url("The provider URL must be a valid URL").describe("The Ethereum provider URL"),
    privateKey: z.string().min(1, "The private key is required").describe("The private key for the Ethereum wallet"),
    flippandoGameMasterAddress: z
      .string()
      .min(1, "The FlippandoGameMaster contract address is required")
      .describe("The FlippandoGameMaster contract address"),
    flippandoAddress: z
      .string()
      .min(1, "The Flippando contract address is required")
      .describe("The Flippando contract address"),
    flippandoBundlerAddress: z
    .string()
    .min(1, "The FlippandoBundler contract address is required")
    .describe("The FlippandoBundler contract address"),
    flipndAddress: z
      .string()
      .min(1, "The Flipnd contract address is required")
      .describe("The Flipnd contract address"),
    chainId: z.number().int().positive().describe("The chain ID"),
    twitterApiKey: z.string().min(1, "The Twitter API key is required").describe("The Twitter API key"),
    twitterApiSecret: z.string().min(1, "The Twitter API secret is required").describe("The Twitter API secret"),
    twitterAccessToken: z.string().min(1, "The Twitter access token is required").describe("The Twitter access token"),
    twitterAccessSecret: z
      .string()
      .min(1, "The Twitter access secret is required")
      .describe("The Twitter access secret"),
  })
  .strip()
  .describe("Options for initializing FlippandoAgentkit")

const EnvSchema = z.object({
  CDP_API_KEY_NAME: z.string().min(1, "CDP_API_KEY_NAME must be defined").describe("Cdp API key name"),
  CDP_API_KEY_PRIVATE_KEY: z
    .string()
    .min(1, "CDP_API_KEY_PRIVATE_KEY must be defined")
    .describe("Cdp API key private key"),
  FLIPPANDO_PROVIDER_URL: z
    .string()
    .url("FLIPPANDO_PROVIDER_URL must be a valid URL")
    .describe("The Flippando provider URL"),
  FLIPPANDO_PRIVATE_KEY: z
    .string()
    .min(1, "FLIPPANDO_PRIVATE_KEY is required")
    .describe("The private key for the wallet"),
  FLIPPANDO_GAMEMASTER_ADDRESS: z
    .string()
    .min(1, "FLIPPANDO_GAMEMASTER_ADDRESS is required")
    .describe("The FlippandoGameMaster contract address"),
  FLIPPANDO_ADDRESS: z.string().min(1, "FLIPPANDO_ADDRESS is required").describe("The Flippando contract address"),
  FLIPPANDO_BUNDLER_ADDRESS: z.string().min(1, "FLIPPANDO_BUNDLER_ADDRESS is required").describe("The FlippandoBundler contract address"),
  FLIPND_ADDRESS: z.string().min(1, "FLIPND_ADDRESS is required").describe("The Flipnd contract address"),
  FLIPPANDO_CHAIN_ID: z.string().transform(Number).pipe(z.number().int().positive()).describe("The chain ID"),
  TWITTER_API_KEY: z.string().min(1, "TWITTER_API_KEY is required").describe("The Twitter API key"),
  TWITTER_API_SECRET: z.string().min(1, "TWITTER_API_SECRET is required").describe("The Twitter API secret"),
  TWITTER_ACCESS_TOKEN: z.string().min(1, "TWITTER_ACCESS_TOKEN is required").describe("The Twitter access token"),
  TWITTER_ACCESS_SECRET: z.string().min(1, "TWITTER_ACCESS_SECRET is required").describe("The Twitter access secret"),
})

export class FlippandoAgentkit {
  private config: z.infer<typeof FlippandoAgentkitOptions>
  private provider: ethers.providers.JsonRpcProvider
  private signer: ethers.Wallet

  public constructor(options?: z.infer<typeof FlippandoAgentkitOptions>) {
    try {
      const env = EnvSchema.parse(process.env)

      options = {
        cdpApiKeyName: options?.cdpApiKeyName || env.CDP_API_KEY_NAME,
        cdpApiKeyPrivateKey: options?.cdpApiKeyPrivateKey || env.CDP_API_KEY_PRIVATE_KEY,
        providerUrl: options?.providerUrl || env.FLIPPANDO_PROVIDER_URL,
        privateKey: options?.privateKey || env.FLIPPANDO_PRIVATE_KEY,
        flippandoGameMasterAddress: options?.flippandoGameMasterAddress || env.FLIPPANDO_GAMEMASTER_ADDRESS,
        flippandoAddress: options?.flippandoAddress || env.FLIPPANDO_ADDRESS,
        flippandoBundlerAddress: options?.flippandoBundlerAddress || env.FLIPPANDO_BUNDLER_ADDRESS,
        flipndAddress: options?.flipndAddress || env.FLIPND_ADDRESS,
        chainId: options?.chainId || env.FLIPPANDO_CHAIN_ID,
        twitterApiKey: options?.twitterApiKey || env.TWITTER_API_KEY,
        twitterApiSecret: options?.twitterApiSecret || env.TWITTER_API_SECRET,
        twitterAccessToken: options?.twitterAccessToken || env.TWITTER_ACCESS_TOKEN,
        twitterAccessSecret: options?.twitterAccessSecret || env.TWITTER_ACCESS_SECRET,
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        error.errors.forEach((err) => console.log(`Error: ${err.path[0]} is required`))
      }
      throw new Error("Flippando config could not be loaded.")
    }

    if (!this.validateOptions(options)) {
      throw new Error("Flippando Agentkit options could not be validated.")
    }

    this.config = options
    this.provider = new ethers.providers.JsonRpcProvider(this.config.providerUrl)
    this.signer = new ethers.Wallet(this.config.privateKey!, this.provider)
  }

  async run<TActionSchema extends FlippandoActionSchemaAny, TResponseSchema extends z.ZodType<any, any>>(
    action: FlippandoAction<TActionSchema, TResponseSchema>,
    args: z.infer<TActionSchema>,
  ): Promise<z.infer<TResponseSchema>> {
    return await action.func(args, this)
  }

  validateOptions(options: z.infer<typeof FlippandoAgentkitOptions>): boolean {
    try {
      FlippandoAgentkitOptions.parse(options)
    } catch (error) {
      if (error instanceof z.ZodError) {
        error.errors.forEach((err) => console.log("Error:", err.message))
      }
      return false
    }
    return true
  }

  async updateNetwork(
    chainId: number,
    rpcUrl: string,
    flippandoGameMasterAddress: string,
    flippandoAddress: string,
    flippandoBundlerdAddress: string,
    flipndAddress: string,
  ): Promise<void> {
    this.config.chainId = chainId
    this.config.providerUrl = rpcUrl
    this.config.flippandoGameMasterAddress = flippandoGameMasterAddress
    this.config.flippandoAddress = flippandoAddress
    this.config.flippandoBundlerAddress = flippandoBundlerdAddress
    this.config.flipndAddress = flipndAddress

    this.provider = new ethers.providers.JsonRpcProvider(rpcUrl)
    this.signer = new ethers.Wallet(this.config.privateKey!, this.provider)

    // Verify the connection to the new network
    try {
      await this.provider.getNetwork()
    } catch (error) {
      throw new Error(`Failed to connect to the new network: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  getProvider(): ethers.providers.JsonRpcProvider {
    return this.provider
  }

  getSigner(): ethers.Wallet {
    return this.signer
  }

  getFlippandoGameMasterAddress(): string {
    return this.config.flippandoGameMasterAddress!
  }

  getFlippandoAddress(): string {
    return this.config.flippandoAddress!
  }

  getFlippandoBundlerAddress(): string {
    return this.config.flippandoBundlerAddress!
  }

  getFlipndAddress(): string {
    return this.config.flipndAddress!
  }

  getChainId(): number {
    return this.config.chainId!
  }

  getTwitterApiKey(): string {
    return this.config.twitterApiKey!
  }

  getTwitterApiSecret(): string {
    return this.config.twitterApiSecret!
  }

  getTwitterAccessToken(): string {
    return this.config.twitterAccessToken!
  }

  getTwitterAccessSecret(): string {
    return this.config.twitterAccessSecret!
  }
}

