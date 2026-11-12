import {
  AccountLayout,
  getAssociatedTokenAddressSync,
  NATIVE_MINT,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { Connection, PublicKey, VersionedTransaction } from "@solana/web3.js";
import { checkSwapBeforeSigning, SOL_FEE_ALLOWANCE_LAMPORTS } from "./swapCheck";

const OWNER = new PublicKey("9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM");
const USDC = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
const JUP = new PublicKey("JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN");
const OWNER_USDC = getAssociatedTokenAddressSync(USDC, OWNER, false, TOKEN_PROGRAM_ID);
const OWNER_JUP = getAssociatedTokenAddressSync(JUP, OWNER, false, TOKEN_PROGRAM_ID);
const TX = {} as VersionedTransaction;

/**
 * Builds token account data holding an amount.
 *
 * @param mint - The token mint
 * @param amount - The raw amount
 * @returns The encoded account data
 */
function tokenAccount(mint: PublicKey, amount: bigint): Buffer {
  const data = Buffer.alloc(AccountLayout.span);
  AccountLayout.encode(
    {
      mint,
      owner: OWNER,
      amount,
      delegateOption: 0,
      delegate: PublicKey.default,
      state: 1,
      isNativeOption: 0,
      isNative: BigInt(0),
      delegatedAmount: BigInt(0),
      closeAuthorityOption: 0,
      closeAuthority: PublicKey.default,
    },
    data,
  );
  return data;
}

/**
 * A connection whose accounts hold `before`, and whose simulation returns `after` (null data: account doesn't exist).
 *
 * @param before - Lamports and token data per watched account, before the swap
 * @param after - The same, after the simulated swap
 * @param err - A simulation error, if the swap fails
 * @returns The mocked connection
 */
function connection(
  before: { lamports: number; data?: Buffer }[],
  after: { lamports: number; data?: Buffer }[],
  err: unknown = null,
): Connection {
  return {
    getAccountInfo: jest.fn().mockResolvedValue({ owner: TOKEN_PROGRAM_ID }),
    getMultipleAccountsInfo: jest
      .fn()
      .mockResolvedValue(
        before.map(a => ({ lamports: a.lamports, data: a.data ?? Buffer.alloc(0) })),
      ),
    simulateTransaction: jest.fn().mockResolvedValue({
      value: {
        err,
        accounts: after.map(a => ({
          lamports: a.lamports,
          data: [(a.data ?? Buffer.alloc(0)).toString("base64"), "base64"],
        })),
      },
    }),
  } as unknown as Connection;
}

const SOL = 1_000_000_000;

describe("checkSwapBeforeSigning", () => {
  const solToUsdc = {
    inputMint: NATIVE_MINT.toBase58(),
    outputMint: USDC.toBase58(),
    inAmount: "500000000",
    otherAmountThreshold: "70000000",
  };

  it("passes a swap that sells the quoted SOL and pays at least the minimum USDC to the wallet", async () => {
    const conn = connection(
      [{ lamports: 2 * SOL }, { lamports: 2039280, data: tokenAccount(USDC, BigInt(0)) }],
      [
        { lamports: 2 * SOL - 500_000_000 - 7100 },
        { lamports: 2039280, data: tokenAccount(USDC, BigInt(71_000_000)) },
      ],
    );
    await expect(checkSwapBeforeSigning(conn, OWNER, TX, solToUsdc)).resolves.toBeNull();
    expect(conn.simulateTransaction).toHaveBeenCalledWith(
      TX,
      expect.objectContaining({
        sigVerify: false,
        accounts: { encoding: "base64", addresses: [OWNER.toBase58(), OWNER_USDC.toBase58()] },
      }),
    );
  });

  it("refuses a swap whose output doesn't reach the wallet (pays someone else)", async () => {
    const conn = connection(
      [{ lamports: 2 * SOL }, { lamports: 2039280, data: tokenAccount(USDC, BigInt(0)) }],
      [
        { lamports: 2 * SOL - 500_000_000 - 7100 },
        { lamports: 2039280, data: tokenAccount(USDC, BigInt(0)) },
      ],
    );
    await expect(checkSwapBeforeSigning(conn, OWNER, TX, solToUsdc)).resolves.toMatch(
      /less than the quote's minimum 70000000/,
    );
  });

  it("refuses a swap that takes more SOL than the quote plus fees", async () => {
    const conn = connection(
      [{ lamports: 2 * SOL }, { lamports: 2039280, data: tokenAccount(USDC, BigInt(0)) }],
      [
        { lamports: 2 * SOL - 500_000_000 - Number(SOL_FEE_ALLOWANCE_LAMPORTS) - 1 },
        { lamports: 2039280, data: tokenAccount(USDC, BigInt(71_000_000)) },
      ],
    );
    await expect(checkSwapBeforeSigning(conn, OWNER, TX, solToUsdc)).resolves.toMatch(
      /would lose .* lamports of SOL/,
    );
  });

  it("refuses a token swap that gives up more of the input token than quoted", async () => {
    const quote = {
      inputMint: USDC.toBase58(),
      outputMint: JUP.toBase58(),
      inAmount: "5000000",
      otherAmountThreshold: "9000000",
    };
    const conn = connection(
      [
        { lamports: SOL },
        { lamports: 2039280, data: tokenAccount(USDC, BigInt(50_000_000)) },
        { lamports: 2039280, data: tokenAccount(JUP, BigInt(0)) },
      ],
      [
        { lamports: SOL - 7100 },
        { lamports: 2039280, data: tokenAccount(USDC, BigInt(0)) },
        { lamports: 2039280, data: tokenAccount(JUP, BigInt(10_000_000)) },
      ],
    );
    await expect(checkSwapBeforeSigning(conn, OWNER, TX, quote)).resolves.toMatch(
      /give up 50000000 .* more than the quoted 5000000/,
    );
    expect((conn.simulateTransaction as jest.Mock).mock.calls[0][1].accounts.addresses).toEqual([
      OWNER.toBase58(),
      OWNER_USDC.toBase58(),
      OWNER_JUP.toBase58(),
    ]);
  });

  it("passes a token swap whose output account is opened by the swap", async () => {
    const quote = {
      inputMint: USDC.toBase58(),
      outputMint: JUP.toBase58(),
      inAmount: "5000000",
      otherAmountThreshold: "9000000",
    };
    const conn = connection(
      [
        { lamports: SOL },
        { lamports: 2039280, data: tokenAccount(USDC, BigInt(5_000_000)) },
        { lamports: 0 },
      ],
      [
        { lamports: SOL - 2039280 - 7100 },
        { lamports: 2039280, data: tokenAccount(USDC, BigInt(0)) },
        { lamports: 2039280, data: tokenAccount(JUP, BigInt(9_500_000)) },
      ],
    );
    await expect(checkSwapBeforeSigning(conn, OWNER, TX, quote)).resolves.toBeNull();
  });

  it("refuses a swap whose simulation fails", async () => {
    const conn = connection(
      [{ lamports: SOL }, { lamports: 0 }],
      [{ lamports: SOL }, { lamports: 0 }],
      { InstructionError: [2, { Custom: 6001 }] },
    );
    await expect(checkSwapBeforeSigning(conn, OWNER, TX, solToUsdc)).resolves.toMatch(
      /simulation failed/,
    );
  });
});
