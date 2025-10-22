import { z } from "zod";
import { WalletProvider } from "../wallet-providers";
import { sendAnalyticsEvent } from "../analytics";

import "reflect-metadata";

/**
 * Parameters for the create action decorator
 */
export interface CreateActionDecoratorParams {
  /**
   * The name of the action
   */
  name: string;

  /**
   * The description of the action
   */
  description: string;

  /**
   * The schema of the action
   */
  schema: z.ZodSchema;
}

/**
 * Metadata key for the action decorator
 */
export const ACTION_DECORATOR_KEY = Symbol("agentkit:action");

/**
 * Metadata for AgentKit actions
 */
export interface ActionMetadata {
  /**
   * The name of the action
   */
  name: string;

  /**
   * The description of the action
   */
  description: string;

  /**
   * The schema of the action
   */
  schema: z.ZodSchema;

  /**
   * The function to invoke the action
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  invoke: (...args: any[]) => any;

  /**
   * The wallet provider to use for the action
   */
  walletProvider: boolean;
}

/**
 * A map of action names to their metadata
 */
export type StoredActionMetadata = Map<string, ActionMetadata>;

/**
 * Decorator to embed metadata on class methods to indicate they are actions accessible to the agent
 *
 * @param params - The parameters for the action decorator
 * @returns A decorator function
 *
 * @example
 * ```typescript
 * class MyActionProvider extends ActionProvider {
 *   @CreateAction({ name: "my_action", description: "My action", schema: myActionSchema })
 *   public myAction(args: z.infer<typeof myActionSchema>) {
 *     // ...
 *   }
 * }
 * ```
 */
export function CreateAction(params: CreateActionDecoratorParams) {
  return (target: object, propertyKey: string, descriptor: PropertyDescriptor) => {
    const prefixedActionName = `${target.constructor.name}_${params.name}`;

    const originalMethod = descriptor.value;

    const { isWalletProvider } = validateActionMethodArguments(target, propertyKey);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    descriptor.value = function (...args: any[]) {
      let walletMetrics: Record<string, string> = {};

      if (isWalletProvider) {
        walletMetrics = {
          wallet_provider: args[0].getName(),
          wallet_address: args[0].getAddress(),
          network_id: args[0].getNetwork().networkId,
          chain_id: args[0].getNetwork().chainId,
          protocol_family: args[0].getNetwork().protocolFamily,
        };
      }

      sendAnalyticsEvent({
        name: "agent_action_invocation",
        action: "invoke_action",
        component: "agent_action",
        action_name: prefixedActionName,
        class_name: target.constructor.name,
        method_name: propertyKey,
        ...walletMetrics,
      });

      return originalMethod.apply(this, args);
    };

    const existingMetadata: StoredActionMetadata =
      Reflect.getMetadata(ACTION_DECORATOR_KEY, target.constructor) || new Map();

    const metaData: ActionMetadata = {
      name: prefixedActionName,
      description: params.description,
      schema: params.schema,
      invoke: descriptor.value,
      walletProvider: isWalletProvider,
    };

    existingMetadata.set(propertyKey, metaData);

    Reflect.defineMetadata(ACTION_DECORATOR_KEY, existingMetadata, target.constructor);

    return target;
  };
}

/**
 * Validates the arguments of an action method
 *
 * @param target - The target object
 * @param propertyKey - The property key
 * @returns An object containing the wallet provider flag
 */
function validateActionMethodArguments(
  target: object,
  propertyKey: string,
): {
  isWalletProvider: boolean;
} {
  const className = target instanceof Object ? target.constructor.name : undefined;

  const params = Reflect.getMetadata("design:paramtypes", target, propertyKey);

  if (params == null) {
    throw new Error(
      `Failed to get parameters for action method ${propertyKey} on class ${className}`,
    );
  }

  if (params.length > 2) {
    throw new Error(
      `Action method ${propertyKey} on class ${className} has more than 2 parameters`,
    );
  }

  const walletProviderParam = params.find(param => {
    if (!param || !param.prototype) {
      return false;
    }

    if (param === WalletProvider) return true;
    return param.prototype instanceof WalletProvider;
  });

  return {
    isWalletProvider: !!walletProviderParam,
  };
}
