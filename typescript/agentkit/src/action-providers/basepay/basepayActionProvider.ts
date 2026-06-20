import { z } from "zod";
  import { ActionProvider } from "../actionProvider";
  import { Network } from "../../network";
  import { CreateAction } from "../actionDecorator";
  import {
    SendUsdcSchema,
    SendUsdcGaslessSchema,
    BatchPayUsdcSchema,
    CreateEscrowSchema,
    SubscribeSchema,
  } from "./schemas";
  import { encodeFunctionData, parseUnits, formatUnits, type Hex } from "viem";
  import { EvmWalletProvider } from "../../wallet-providers";

  const BASE_CHAIN_ID = "8453";
  const BASESCAN = "https://basescan.org/tx";
  const DEFAULT_RELAY_URL = "https://base-pay.replit.app";

  // ── Contract addresses (Base Mainnet) ─────────────────────────────────────────
  const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as const;
  const USDC_DECIMALS = 6;
  const BATCH_PAY = "0xe40d2292c050566d16cecda74627b70778806c68" as const;
  const ESCROW_V2 = "0x1eb2b1e8dda64fc4ccb0537574f2a2ca9f307499" as const;
  const SUBSCRIPTION_MANAGER = "0x101918a252b3852ac4b50b7bbf2525d3084d5421" as const;

  // ── Minimal ABIs ──────────────────────────────────────────────────────────────
  const ERC20_ABI = [
    { name: "transfer", type: "function", stateMutability: "nonpayable",
      inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }],
      outputs: [{ name: "", type: "bool" }] },
    { name: "approve", type: "function", stateMutability: "nonpayable",
      inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }],
      outputs: [{ name: "", type: "bool" }] },
    { name: "allowance", type: "function", stateMutability: "view",
      inputs: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }],
      outputs: [{ name: "", type: "uint256" }] },
  ] as const;

  const BATCH_PAY_ABI = [
    { name: "batchSend", type: "function", stateMutability: "nonpayable",
      inputs: [
        { name: "token", type: "address" }, { name: "recipients", type: "address[]" },
        { name: "amounts", type: "uint256[]" }, { name: "memo", type: "string" },
      ], outputs: [] },
  ] as const;

  const ESCROW_ABI = [
    { name: "create", type: "function", stateMutability: "nonpayable",
      inputs: [
        { name: "token", type: "address" }, { name: "payee", type: "address" },
        { name: "amount", type: "uint256" }, { name: "ttl", type: "uint256" },
        { name: "memo", type: "string" },
      ], outputs: [{ name: "id", type: "uint256" }] },
  ] as const;

  const SUBSCRIPTION_ABI = [
    { name: "subscribe", type: "function", stateMutability: "nonpayable",
      inputs: [
        { name: "token", type: "address" }, { name: "payee", type: "address" },
        { name: "amount", type: "uint256" }, { name: "interval", type: "uint256" },
        { name: "memo", type: "string" },
      ], outputs: [{ name: "id", type: "uint256" }] },
  ] as const;

  // ── Helpers ───────────────────────────────────────────────────────────────────
  function toAtomic(human: string): bigint {
    return parseUnits(human, USDC_DECIMALS);
  }

  function txLink(hash: Hex): string {
    return `${BASESCAN}/${hash}`;
  }

  async function ensureAllowance(
    walletProvider: EvmWalletProvider,
    spender: string,
    required: bigint,
  ): Promise<Hex | null> {
    const owner = walletProvider.getAddress();
    const current = await walletProvider.readContract({
      address: USDC,
      abi: ERC20_ABI,
      functionName: "allowance",
      args: [owner as Hex, spender as Hex],
    });
    if (typeof current === "bigint" && current >= required) return null;

    const approveTx = await walletProvider.sendTransaction({
      to: USDC,
      data: encodeFunctionData({
        abi: ERC20_ABI,
        functionName: "approve",
        args: [spender as Hex, required],
      }),
    });
    await walletProvider.waitForTransactionReceipt(approveTx);
    return approveTx;
  }

  export interface BasePayConfig {
    relayUrl?: string;
  }

  /**
   * BasePayActionProvider provides AI agents with USDC payment primitives on Base Mainnet:
   * gasless EIP-3009 transfers, batch payments, time-locked escrow, and on-chain subscriptions.
   *
   * Contracts: https://github.com/osr21/basepay/blob/main/contracts/addresses.json
   * BasePay dApp: https://base-pay.replit.app
   */
  export class BasePayActionProvider extends ActionProvider<EvmWalletProvider> {
    private readonly relayUrl: string;

    constructor(config?: BasePayConfig) {
      super("basepay", []);
      this.relayUrl = config?.relayUrl ?? DEFAULT_RELAY_URL;
    }

    @CreateAction({
      name: "basepay_send_usdc",
      description: `
  Send USDC to any address on Base Mainnet. The agent wallet pays ETH gas.

  Inputs:
  - to: recipient Ethereum address (0x…)
  - amount: USDC amount as a decimal string (e.g. "10.5" for 10.5 USDC)

  Requirements: agent wallet must hold USDC and ETH for gas (~0.0002 ETH typical).
  Returns: transaction hash and Basescan link.
  `.trim(),
      schema: SendUsdcSchema,
    })
    async sendUsdc(
      walletProvider: EvmWalletProvider,
      args: z.infer<typeof SendUsdcSchema>,
    ): Promise<string> {
      try {
        const hash = await walletProvider.sendTransaction({
          to: USDC,
          data: encodeFunctionData({
            abi: ERC20_ABI,
            functionName: "transfer",
            args: [args.to as Hex, toAtomic(args.amount)],
          }),
        });
        await walletProvider.waitForTransactionReceipt(hash);
        return `Sent ${args.amount} USDC to ${args.to}\nTransaction: ${txLink(hash)}`;
      } catch (e: unknown) {
        return `Error sending USDC: ${e instanceof Error ? e.message : String(e)}`;
      }
    }

    @CreateAction({
      name: "basepay_send_usdc_gasless",
      description: `
  Send USDC gaslessly via the BasePay EIP-3009 relay — the relay pays ETH gas, the agent needs NO ETH.

  How it works:
  1. Agent signs a TransferWithAuthorization EIP-712 typed message (no on-chain tx)
  2. BasePay relay submits the authorization to USDC.transferWithAuthorization()
  3. USDC moves directly from agent wallet to recipient

  Inputs:
  - to: recipient Ethereum address (0x…)
  - amount: USDC decimal (e.g. "5"). Max 1,000,000 USDC.

  Requirements: wallet must support signTypedData (ViemWalletProvider, CdpEvmWalletProvider).
  Returns: relay transaction hash and Basescan link.
  `.trim(),
      schema: SendUsdcGaslessSchema,
    })
    async sendUsdcGasless(
      walletProvider: EvmWalletProvider,
      args: z.infer<typeof SendUsdcGaslessSchema>,
    ): Promise<string> {
      const wp = walletProvider as EvmWalletProvider & {
        signTypedData?: (p: Record<string, unknown>) => Promise<Hex>;
      };
      if (typeof wp.signTypedData !== "function") {
        return (
          "Error: wallet provider does not support signTypedData. " +
          "Use ViemWalletProvider or CdpEvmWalletProvider for gasless transfers."
        );
      }

      const from = walletProvider.getAddress();
      const value = toAtomic(args.amount);
      const validAfter = "0";
      const validBefore = String(Math.floor(Date.now() / 1000) + 3600);
      const randomBytes = new Uint8Array(32);
      crypto.getRandomValues(randomBytes);
      const nonce = ("0x" +
        Array.from(randomBytes)
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("")) as Hex;

      let signature: Hex;
      try {
        signature = await wp.signTypedData({
          domain: { name: "USD Coin", version: "2", chainId: 8453, verifyingContract: USDC },
          types: {
            TransferWithAuthorization: [
              { name: "from", type: "address" },
              { name: "to", type: "address" },
              { name: "value", type: "uint256" },
              { name: "validAfter", type: "uint256" },
              { name: "validBefore", type: "uint256" },
              { name: "nonce", type: "bytes32" },
            ],
          },
          primaryType: "TransferWithAuthorization",
          message: {
            from,
            to: args.to,
            value,
            validAfter: BigInt(validAfter),
            validBefore: BigInt(validBefore),
            nonce,
          },
        });
      } catch (e: unknown) {
        return `Error signing EIP-3009 authorization: ${e instanceof Error ? e.message : String(e)}`;
      }

      const sigHex = signature.slice(2);
      const r = ("0x" + sigHex.slice(0, 64)) as Hex;
      const s = ("0x" + sigHex.slice(64, 128)) as Hex;
      const vByte = parseInt(sigHex.slice(128, 130), 16);
      const v = vByte < 27 ? vByte + 27 : vByte;

      try {
        const resp = await fetch(`${this.relayUrl}/api/gasless/relay`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ from, to: args.to, value: value.toString(), validAfter, validBefore, nonce, v, r, s }),
        });
        const data = (await resp.json()) as { txHash?: string; error?: string };
        if (!resp.ok || data.error) return `Relay error: ${data.error ?? resp.statusText}`;
        return `Gaslessly sent ${args.amount} USDC to ${args.to} (relay paid gas)\nTransaction: ${txLink(data.txHash as Hex)}`;
      } catch (e: unknown) {
        return `Error calling BasePay relay: ${e instanceof Error ? e.message : String(e)}`;
      }
    }

    @CreateAction({
      name: "basepay_batch_pay_usdc",
      description: `
  Pay up to 200 recipients USDC atomically in one transaction. Auto-approves allowance if needed.

  Inputs:
  - recipients: array of { address, amount } (max 200). address is a 0x Ethereum address; amount is USDC decimal.
  - memo: optional string recorded on-chain (max 64 chars)

  Returns: recipient count, total USDC, and Basescan link.
  `.trim(),
      schema: BatchPayUsdcSchema,
    })
    async batchPayUsdc(
      walletProvider: EvmWalletProvider,
      args: z.infer<typeof BatchPayUsdcSchema>,
    ): Promise<string> {
      const amounts = args.recipients.map((r) => toAtomic(r.amount));
      const total = amounts.reduce((a, b) => a + b, 0n);
      try {
        const approveTx = await ensureAllowance(walletProvider, BATCH_PAY, total);
        const hash = await walletProvider.sendTransaction({
          to: BATCH_PAY,
          data: encodeFunctionData({
            abi: BATCH_PAY_ABI,
            functionName: "batchSend",
            args: [USDC, args.recipients.map((r) => r.address as Hex), amounts, args.memo],
          }),
        });
        await walletProvider.waitForTransactionReceipt(hash);
        return [
          `Batch payment: ${args.recipients.length} recipients, ${formatUnits(total, USDC_DECIMALS)} USDC`,
          ...(approveTx ? [`Approve: ${txLink(approveTx)}`] : []),
          `Batch tx: ${txLink(hash)}`,
        ].join("\n");
      } catch (e: unknown) {
        return `Error in batch payment: ${e instanceof Error ? e.message : String(e)}`;
      }
    }

    @CreateAction({
      name: "basepay_create_escrow",
      description: `
  Lock USDC in a time-locked escrow. Payee can claim after the unlock period; payer can reclaim after.

  Inputs:
  - payee: beneficiary address (0x…)
  - amount: USDC to lock (e.g. "100")
  - unlockAfterSeconds: lock duration in seconds (e.g. 86400 = 1 day, 604800 = 1 week)
  - memo: optional on-chain label (max 64 chars)

  Returns: escrow ID (needed for release/refund), Basescan link.
  `.trim(),
      schema: CreateEscrowSchema,
    })
    async createEscrow(
      walletProvider: EvmWalletProvider,
      args: z.infer<typeof CreateEscrowSchema>,
    ): Promise<string> {
      const amount = toAtomic(args.amount);
      try {
        const approveTx = await ensureAllowance(walletProvider, ESCROW_V2, amount);
        const hash = await walletProvider.sendTransaction({
          to: ESCROW_V2,
          data: encodeFunctionData({
            abi: ESCROW_ABI,
            functionName: "create",
            args: [USDC, args.payee as Hex, amount, BigInt(args.unlockAfterSeconds), args.memo],
          }),
        });
        const receipt = await walletProvider.waitForTransactionReceipt(hash);
        const escrowId = (receipt as { logs?: { topics?: string[] }[] })?.logs?.[0]?.topics?.[1] ?? "see tx";
        return [
          `Escrow created: ${args.amount} USDC for ${args.payee}`,
          `Unlock in: ${(args.unlockAfterSeconds / 86400).toFixed(1)} days`,
          `Escrow ID: ${escrowId}`,
          ...(approveTx ? [`Approve: ${txLink(approveTx)}`] : []),
          `Create tx: ${txLink(hash)}`,
        ].join("\n");
      } catch (e: unknown) {
        return `Error creating escrow: ${e instanceof Error ? e.message : String(e)}`;
      }
    }

    @CreateAction({
      name: "basepay_subscribe",
      description: `
  Create a recurring on-chain USDC subscription. Anyone can call charge() once per interval.

  Inputs:
  - payee: address that receives USDC each period (0x…)
  - amount: USDC per interval (e.g. "9.99")
  - intervalSeconds: seconds between charges (e.g. 604800 weekly, 2592000 monthly)
  - memo: optional on-chain label (max 64 chars)

  Auto-approves SubscriptionManager for 24× the per-period amount (24 billing cycles).
  Returns: subscription ID, Basescan link.
  `.trim(),
      schema: SubscribeSchema,
    })
    async subscribe(
      walletProvider: EvmWalletProvider,
      args: z.infer<typeof SubscribeSchema>,
    ): Promise<string> {
      const amount = toAtomic(args.amount);
      try {
        const approveTx = await ensureAllowance(walletProvider, SUBSCRIPTION_MANAGER, amount * 24n);
        const hash = await walletProvider.sendTransaction({
          to: SUBSCRIPTION_MANAGER,
          data: encodeFunctionData({
            abi: SUBSCRIPTION_ABI,
            functionName: "subscribe",
            args: [USDC, args.payee as Hex, amount, BigInt(args.intervalSeconds), args.memo],
          }),
        });
        await walletProvider.waitForTransactionReceipt(hash);
        const period = args.intervalSeconds === 604800 ? "weekly"
          : args.intervalSeconds === 2592000 ? "monthly"
          : `every ${args.intervalSeconds}s`;
        return [
          `Subscription: ${args.amount} USDC ${period} to ${args.payee}`,
          `Anyone can call charge() once per interval`,
          ...(approveTx ? [`Approve: ${txLink(approveTx)}`] : []),
          `Subscribe tx: ${txLink(hash)}`,
        ].join("\n");
      } catch (e: unknown) {
        return `Error creating subscription: ${e instanceof Error ? e.message : String(e)}`;
      }
    }

    supportsNetwork(network: Network): boolean {
      return network.chainId === BASE_CHAIN_ID;
    }
  }

  export function basePayActionProvider(config?: BasePayConfig): BasePayActionProvider {
    return new BasePayActionProvider(config);
  }
  