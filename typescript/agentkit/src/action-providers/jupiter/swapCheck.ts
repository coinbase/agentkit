import { AccountLayout, getAssociatedTokenAddressSync, NATIVE_MINT } from "@solana/spl-token";
import { Connection, PublicKey, VersionedTransaction } from "@solana/web3.js";

/**
 * SOL a swap may cost the wallet beyond the SOL it sells: network and priority fees, and rent for a token account the
 * swap opens (about 0.002 SOL). Anything above this leaving the wallet is not part of the swap.
 */
export const SOL_FEE_ALLOWANCE_LAMPORTS = BigInt(10_000_000); // 0.01 SOL

/**
 * The parts of Jupiter's quote the check compares the transaction against.
 */
export interface SwapQuoteTerms {
  inputMint: string;
  outputMint: string;
  inAmount: string;
  otherAmountThreshold: string;
}

/**
 * Reads the token amount of a token account's data, or 0 when the account doesn't exist yet.
 *
 * @param data - The account data, if the account exists
 * @returns The raw token amount
 */
function tokenAmount(data: Buffer | null | undefined): bigint {
  if (!data || data.length < AccountLayout.span) return BigInt(0);
  return BigInt(AccountLayout.decode(data.subarray(0, AccountLayout.span)).amount.toString());
}

/**
 * Finds the wallet's token account for a mint, using the mint's own token program (SPL Token or Token-2022).
 *
 * @param connection - The Solana connection
 * @param mint - The token mint
 * @param owner - The wallet
 * @returns The associated token account address
 */
async function tokenAccountOf(
  connection: Connection,
  mint: PublicKey,
  owner: PublicKey,
): Promise<PublicKey> {
  const mintInfo = await connection.getAccountInfo(mint);
  if (!mintInfo) throw new Error(`mint ${mint.toBase58()} not found`);
  return getAssociatedTokenAddressSync(mint, owner, false, mintInfo.owner);
}

/**
 * Simulates a swap transaction built by Jupiter and checks it against the quote before the wallet signs it: the wallet
 * must give up no more than the quoted input amount, receive at least the quote's minimum output
 * (otherAmountThreshold), and lose no other SOL beyond fees and rent. This catches a swap transaction that would fail,
 * pay someone else, or move more out of the wallet than the quote says, for example from a wrong or tampered API
 * response.
 *
 * @param connection - The Solana connection
 * @param owner - The wallet that will sign
 * @param tx - The unsigned swap transaction
 * @param quote - Jupiter's quote for the swap
 * @returns A description of the problem, or null when the transaction does what the quote says
 */
export async function checkSwapBeforeSigning(
  connection: Connection,
  owner: PublicKey,
  tx: VersionedTransaction,
  quote: SwapQuoteTerms,
): Promise<string | null> {
  const inputMint = new PublicKey(quote.inputMint);
  const outputMint = new PublicKey(quote.outputMint);
  const sellsSol = inputMint.equals(NATIVE_MINT);
  const buysSol = outputMint.equals(NATIVE_MINT);
  const inputAccount = sellsSol ? null : await tokenAccountOf(connection, inputMint, owner);
  const outputAccount = buysSol ? null : await tokenAccountOf(connection, outputMint, owner);

  const watched = [
    owner,
    ...(inputAccount ? [inputAccount] : []),
    ...(outputAccount ? [outputAccount] : []),
  ];
  const before = await connection.getMultipleAccountsInfo(watched);
  const simulation = await connection.simulateTransaction(tx, {
    sigVerify: false,
    replaceRecentBlockhash: true,
    accounts: { encoding: "base64", addresses: watched.map(address => address.toBase58()) },
  });
  if (simulation.value.err) {
    return `the simulation failed: ${JSON.stringify(simulation.value.err)}`;
  }
  const after = simulation.value.accounts ?? [];
  const afterData = (i: number) => {
    const account = after[i];
    return account ? Buffer.from(account.data[0], "base64") : null;
  };

  const solBefore = BigInt(before[0]?.lamports ?? 0);
  const solAfter = BigInt(after[0]?.lamports ?? 0);
  const solLost = solBefore - solAfter;
  const inAmount = BigInt(quote.inAmount);
  const minimumOut = BigInt(quote.otherAmountThreshold);

  // What leaves the wallet: the input token (or SOL), and SOL beyond fees and rent.
  const allowedSolLoss = (sellsSol ? inAmount : BigInt(0)) + SOL_FEE_ALLOWANCE_LAMPORTS;
  if (solLost > allowedSolLoss) {
    return `the wallet would lose ${solLost} lamports of SOL, more than ${allowedSolLoss} (the quoted amount sold plus fees and rent)`;
  }
  if (inputAccount) {
    const index = 1;
    const sold = tokenAmount(before[index]?.data) - tokenAmount(afterData(index));
    if (sold > inAmount) {
      return `the wallet would give up ${sold} of ${quote.inputMint}, more than the quoted ${inAmount}`;
    }
  }

  // What reaches the wallet: at least the quote's minimum output.
  if (outputAccount) {
    const index = inputAccount ? 2 : 1;
    const received = tokenAmount(afterData(index)) - tokenAmount(before[index]?.data);
    if (received < minimumOut) {
      return `the wallet would receive ${received} of ${quote.outputMint}, less than the quote's minimum ${minimumOut}`;
    }
  } else if (buysSol && solAfter - solBefore < minimumOut - SOL_FEE_ALLOWANCE_LAMPORTS) {
    return `the wallet would receive ${solAfter - solBefore} lamports of SOL, less than the quote's minimum ${minimumOut} minus fees`;
  }
  return null;
}
