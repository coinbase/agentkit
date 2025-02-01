/* eslint-disable @typescript-eslint/no-explicit-any */

import { z } from "zod";
import { CreateAction } from "./actionDecorator";
import { ActionProvider } from "./actionProvider";
import { Network } from "../network";
import { WalletProvider } from "../wallet-providers";

interface CustomActionProviderOptions<TWalletProvider extends WalletProvider> {
  name: string;
  description: string;
  schema: z.ZodSchema;
  invoke:
    | ((args: any) => Promise<any>)
    | ((walletProvider: TWalletProvider, args: any) => Promise<any>);
}

/**
 * CustomActionProvider is a custom action provider that allows for custom action registration
 */
export class CustomActionProvider<TWalletProvider extends WalletProvider> extends ActionProvider {
  /**
   * Creates a new CustomActionProvider that dynamically adds decorated action methods
   *
   * @param actions - Array of custom actions to be added to the provider
   */
  constructor(actions: CustomActionProviderOptions<TWalletProvider>[]) {
    super("custom", []);

    actions.forEach(({ name, description, schema, invoke }) => {
      // Check if the invoke function expects a wallet provider
      const takesWalletProvider = invoke.length === 2;

      // Define the method on the prototype with the correct signature
      Object.defineProperty(CustomActionProvider.prototype, name, {
        value: takesWalletProvider
          ? async function (walletProvider: WalletProvider, args: unknown) {
              const parsedArgs = schema.parse(args);
              return await (invoke as any)(walletProvider, parsedArgs);
            }
          : async function (args: unknown) {
              const parsedArgs = schema.parse(args);
              return await (invoke as any)(parsedArgs);
            },
        configurable: true,
        writable: true,
        enumerable: true,
      });

      // Manually set the parameter metadata
      const paramTypes = takesWalletProvider ? [WalletProvider, Object] : [Object];
      Reflect.defineMetadata("design:paramtypes", paramTypes, CustomActionProvider.prototype, name);

      // Apply the decorator using original name
      const decoratedMethod = CreateAction({
        name,
        description,
        schema,
      })(
        CustomActionProvider.prototype,
        name,
        Object.getOwnPropertyDescriptor(CustomActionProvider.prototype, name)!,
      );

      // Add the decorated method to the instance
      Object.defineProperty(this, name, {
        value: decoratedMethod,
        configurable: true,
        writable: true,
      });
    });
  }

  /**
   * Custom action providers are supported on all networks
   *
   * @param _ - The network to checkpointSaver
   * @returns true
   */
  supportsNetwork(_: Network): boolean {
    return true;
  }
}

export const customActionProvider = <TWalletProvider extends WalletProvider>(
  actions:
    | CustomActionProviderOptions<TWalletProvider>
    | CustomActionProviderOptions<TWalletProvider>[],
) => new CustomActionProvider<TWalletProvider>(Array.isArray(actions) ? actions : [actions]);
