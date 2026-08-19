import { formatUnits, parseUnits } from "viem";
import { z } from "zod";

import { Network } from "../../network";
import { NEAR_PROTOCOL_FAMILY } from "../../network/near";
import { NearWalletProvider } from "../../wallet-providers/nearWalletProvider";
import { CreateAction } from "../actionDecorator";
import { ActionProvider } from "../actionProvider";
import { CallContractSchema, GetNep141BalanceSchema, TransferNep141Schema } from "./schemas";

/** Actions for NEP-141 tokens and NEAR contract calls. */
export class NearActionProvider extends ActionProvider<NearWalletProvider> {
  /** Create the NEAR action provider. */
  constructor() {
    super("near", []);
  }

  /**
   * Read a NEP-141 token balance.
   *
   * @param walletProvider - Connected NEAR wallet.
   * @param args - Token contract and optional account.
   * @returns A human-readable balance or error.
   */
  @CreateAction({
    name: "get_nep141_balance",
    description: `
Read the balance of a NEP-141 fungible token on NEAR.
- tokenId is the token contract account ID
- accountId is optional and defaults to the connected wallet
- the result includes both atomic and human-readable token units
`,
    schema: GetNep141BalanceSchema,
  })
  async getNep141Balance(
    walletProvider: NearWalletProvider,
    args: z.infer<typeof GetNep141BalanceSchema>,
  ): Promise<string> {
    const accountId = args.accountId ?? walletProvider.getAddress();

    try {
      const [balance, metadata] = await Promise.all([
        walletProvider.getNep141Balance(args.tokenId, accountId),
        walletProvider.getNep141Metadata(args.tokenId),
      ]);

      return [
        `NEP-141 balance for ${accountId}: ${formatUnits(balance, metadata.decimals)} ${metadata.symbol}`,
        `Atomic balance: ${balance}`,
        `Token contract: ${args.tokenId}`,
      ].join("\n");
    } catch (error) {
      return `Error getting NEP-141 balance from ${args.tokenId}: ${error}`;
    }
  }

  /**
   * Transfer NEP-141 tokens in whole token units.
   *
   * @param walletProvider - Connected NEAR wallet.
   * @param args - Token, recipient, and whole-unit amount.
   * @returns Transfer confirmation or error.
   */
  @CreateAction({
    name: "transfer_nep141",
    description: `
Transfer a NEP-141 fungible token on NEAR.
- amount is specified in whole token units, not atomic units
- the recipient must already be registered with tokens that require NEP-145 storage deposits
- returns the transaction hash after optimistic execution succeeds
`,
    schema: TransferNep141Schema,
  })
  async transferNep141(
    walletProvider: NearWalletProvider,
    args: z.infer<typeof TransferNep141Schema>,
  ): Promise<string> {
    try {
      const metadata = await walletProvider.getNep141Metadata(args.tokenId);
      const atomicAmount = parseUnits(args.amount, metadata.decimals);
      const balance = await walletProvider.getNep141Balance(args.tokenId);

      if (atomicAmount <= 0n) {
        throw new Error("Transfer amount must be greater than zero");
      }
      if (balance < atomicAmount) {
        throw new Error(
          `Insufficient ${metadata.symbol} balance. Have ${formatUnits(balance, metadata.decimals)}, need ${args.amount}`,
        );
      }

      const transactionHash = await walletProvider.transferNep141(
        args.tokenId,
        args.receiverId,
        atomicAmount,
      );

      return [
        `Transferred ${args.amount} ${metadata.symbol} to ${args.receiverId}`,
        `Token contract: ${args.tokenId}`,
        `Transaction hash: ${transactionHash}`,
      ].join("\n");
    } catch (error) {
      return `Error transferring NEP-141 tokens: ${error}`;
    }
  }

  /**
   * Submit an arbitrary state-changing NEAR contract call.
   *
   * @param walletProvider - Connected NEAR wallet.
   * @param args - Contract call arguments.
   * @returns Transaction confirmation or error.
   */
  @CreateAction({
    name: "call_contract",
    description: `
Call a state-changing method on a NEAR smart contract.
- args must be a JSON object accepted by the contract method
- gas is specified in raw gas units (30 TGas is 30000000000000)
- deposit is specified in yoctoNEAR (1 NEAR is 1000000000000000000000000)
- confirm the contract, method, arguments, gas, and deposit before invoking
`,
    schema: CallContractSchema,
  })
  async callContract(
    walletProvider: NearWalletProvider,
    args: z.infer<typeof CallContractSchema>,
  ): Promise<string> {
    try {
      const transactionHash = await walletProvider.callContract({
        contractId: args.contractId,
        methodName: args.methodName,
        args: args.args,
        gas: BigInt(args.gas),
        deposit: BigInt(args.deposit),
      });

      return [
        `Called ${args.contractId}.${args.methodName}`,
        `Transaction hash: ${transactionHash}`,
      ].join("\n");
    } catch (error) {
      return `Error calling ${args.contractId}.${args.methodName}: ${error}`;
    }
  }

  /**
   * Return true only for NEAR networks.
   *
   * @param network - Network to inspect.
   * @returns Whether the provider supports the network.
   */
  supportsNetwork(network: Network): boolean {
    return network.protocolFamily === NEAR_PROTOCOL_FAMILY;
  }
}

/**
 * Create a NEAR action provider.
 *
 * @returns A new NEAR action provider.
 */
export const nearActionProvider = () => new NearActionProvider();
