import { ActionProvider, WalletProvider } from "@coinbase/agentkit";
import { WalletProviderConfig, WalletProviderFactory } from "./types";
import { validateEnvironment } from "./env";
import { Agent, AgentConfig } from "./agent";

interface BuilderConfig extends AgentConfig {
  walletFactory: WalletProviderFactory;
  walletConfig: WalletProviderConfig;
}

/**
 * Builder class for creating agent instances with fluent configuration
 */
export class AgentBuilder {
  private config: Partial<BuilderConfig> = {};

  /**
   * Sets the name for the agent
   *
   * @param name - The name to identify the agent
   * @returns The builder instance for chaining
   */
  withName(name: string): this {
    this.config.name = name;
    return this;
  }

  /**
   * Sets the model to be used by the agent
   *
   * @param model - The model identifier (e.g., GPT model name)
   * @returns The builder instance for chaining
   */
  withModel(model: string): this {
    this.config.model = model;
    return this;
  }

  /**
   * Sets the message modifier for agent communications
   *
   * @param modifier - The message modifier string
   * @returns The builder instance for chaining
   */
  withMessageModifier(modifier: string): this {
    this.config.messageModifier = modifier;
    return this;
  }

  /**
   * Sets the required environment variables
   *
   * @param env - Array of required environment variable names
   * @returns The builder instance for chaining
   */
  withRequiredEnv(env: readonly string[]): this {
    this.config.requiredEnv = this.config.walletFactory
      ? [...env, ...this.config.walletFactory.getRequiredEnv()]
      : env;
    return this;
  }

  /**
   * Sets the action providers for the agent
   *
   * @param providers - Array of action providers
   * @returns The builder instance for chaining
   */
  withActionProviders(providers: ActionProvider[]): this {
    this.config.actionProviders = providers;
    return this;
  }

  /**
   * Sets the wallet provider with configuration
   *
   * @param factory - The wallet provider factory
   * @param config - Configuration for the wallet provider
   * @returns The builder instance for chaining
   */
  withWalletProvider<TConfig extends WalletProviderConfig, TProvider extends WalletProvider>(
    factory: WalletProviderFactory<TConfig, TProvider>,
    config: TConfig,
  ): this {
    this.config.walletFactory = factory;
    this.config.walletConfig = config;
    return this;
  }

  /**
   * Builds the agent with the provided configuration
   *
   * @returns A Promise that resolves to the configured Agent instance
   * @throws Error if configuration is invalid or environment variables are missing
   */
  async build(): Promise<Agent> {
    if (!this.isConfigValid()) {
      throw new Error("Missing required agent configuration");
    }

    const config = this.config as Required<BuilderConfig>;

    validateEnvironment(config.requiredEnv);

    const walletConfig = config.walletConfig;
    const walletFactory = config.walletFactory;

    const walletProvider = await walletFactory.createWalletProvider(walletConfig);

    const agentConfig: AgentConfig = {
      name: config.name,
      model: config.model,
      messageModifier: config.messageModifier,
      requiredEnv: config.requiredEnv,
      actionProviders: config.actionProviders,
    };

    return new Agent(agentConfig, walletProvider);
  }

  /**
   * Validates that all required configuration is present
   *
   * @returns True if all required configuration is present, false otherwise
   */
  private isConfigValid(): boolean {
    return !!(
      this.config.name &&
      this.config.model &&
      this.config.messageModifier &&
      this.config.requiredEnv &&
      this.config.actionProviders &&
      this.config.walletFactory &&
      this.config.walletConfig
    );
  }
}
