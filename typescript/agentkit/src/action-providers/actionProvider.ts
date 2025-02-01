import { z } from "zod";
import { WalletProvider } from "../wallet-providers";
import { Network } from "../network";
import { StoredActionMetadata, ACTION_DECORATOR_KEY } from "./actionDecorator";

/**
 * Action is the interface for all actions.
 */
export interface Action<TActionSchema extends z.ZodSchema = z.ZodSchema> {
  name: string;
  description: string;
  schema: TActionSchema;
  invoke: (args: z.infer<TActionSchema>) => Promise<string>;
}

/**
 * ActionProvider is the abstract base class for all action providers.
 *
 * @abstract
 */
export abstract class ActionProvider<TWalletProvider extends WalletProvider = WalletProvider> {
  /**
   * The name of the action provider.
   */
  public readonly name: string;

  /**
   * The action providers to combine.
   */
  public readonly actionProviders: ActionProvider<TWalletProvider>[];

  /**
   * The constructor for the action provider.
   *
   * @param name - The name of the action provider.
   * @param actionProviders - The action providers to combine.
   */
  constructor(
    name: string,
    // Update parameter type to match property type
    actionProviders: ActionProvider<TWalletProvider>[],
  ) {
    this.name = name;
    this.actionProviders = actionProviders;
  }

  /**
   * Gets the actions of the action provider bound to the given wallet provider.
   *
   * @param walletProvider - The wallet provider.
   * @returns The actions of the action provider.
   */
  getActions(walletProvider: TWalletProvider): Action[] {
    const actions: Action[] = [];

    const actionProviders = [this, ...this.actionProviders];

    for (const actionProvider of actionProviders) {
      const actionsMetadataMap: StoredActionMetadata | undefined = Reflect.getMetadata(
        ACTION_DECORATOR_KEY,
        actionProvider.constructor,
      );

      if (!actionsMetadataMap) {
        if (!(actionProvider instanceof ActionProvider)) {
          console.warn(`Warning: ${actionProvider} is not an instance of ActionProvider.`);
        } else {
          console.warn(`Warning: ${actionProvider} has no actions.`);
        }

        continue;
      }

      for (const actionMetadata of actionsMetadataMap.values()) {
        actions.push({
          name: actionMetadata.name,
          description: actionMetadata.description,
          schema: actionMetadata.schema,
          invoke: schemaArgs => {
            const args: unknown[] = [];
            if (actionMetadata.walletProvider) {
              args[0] = walletProvider;
            }

            args.push(schemaArgs);

            return actionMetadata.invoke.apply(actionProvider, args);
          },
        });
      }
    }

    return actions;
  }

  /**
   * Checks if the action provider supports the given network.
   *
   * @param network - The network to check.
   * @returns True if the action provider supports the network, false otherwise.
   */
  abstract supportsNetwork(network: Network): boolean;
}
