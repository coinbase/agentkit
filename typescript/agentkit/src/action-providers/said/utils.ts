import { createHash } from "crypto";
import { PublicKey, SystemProgram, TransactionInstruction } from "@solana/web3.js";
import { SAID_PROGRAM_ID } from "./constants";

const PROGRAM_ID = new PublicKey(SAID_PROGRAM_ID);

/**
 * Computes the 8-byte Anchor instruction discriminator for a global instruction.
 *
 * @param name - The snake_case instruction name
 * @returns The 8-byte discriminator buffer
 */
function anchorDiscriminator(name: string): Buffer {
  return createHash("sha256").update(`global:${name}`).digest().subarray(0, 8);
}

/**
 * Derives the agent identity PDA for a wallet.
 *
 * @param owner - The agent's wallet public key
 * @returns The agent identity PDA
 */
export function deriveAgentIdentityPda(owner: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("agent"), owner.toBuffer()],
    PROGRAM_ID,
  );
  return pda;
}

/**
 * Derives the SAID treasury PDA.
 *
 * @returns The treasury PDA
 */
export function deriveTreasuryPda(): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync([Buffer.from("treasury")], PROGRAM_ID);
  return pda;
}

/**
 * Parses the `is_verified` flag from a raw agent identity account.
 * Layout: 8-byte discriminator, owner (32), authority (32), metadata_uri
 * (4-byte length prefix + bytes), created_at (8), is_verified (1).
 *
 * @param data - The raw account data
 * @returns True if the agent identity is verified on-chain
 */
export function parseIsVerified(data: Buffer): boolean {
  const uriLength = data.readUInt32LE(8 + 32 + 32);
  return data[8 + 32 + 32 + 4 + uriLength + 8] === 1;
}

/**
 * Builds the `register_agent` instruction. The owner signs and pays rent for the
 * agent identity PDA.
 *
 * @param owner - The agent's wallet public key (signer + payer)
 * @param metadataUri - URI of the agent's metadata card (https://, ipfs:// or ar://)
 * @returns The register_agent instruction
 */
export function buildRegisterAgentInstruction(
  owner: PublicKey,
  metadataUri: string,
): TransactionInstruction {
  const uriBytes = Buffer.from(metadataUri, "utf8");
  const uriLen = Buffer.alloc(4);
  uriLen.writeUInt32LE(uriBytes.length);
  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: deriveAgentIdentityPda(owner), isSigner: false, isWritable: true },
      { pubkey: owner, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.concat([anchorDiscriminator("register_agent"), uriLen, uriBytes]),
  });
}

/**
 * Builds the `get_verified` instruction. The authority (the owner, unless transferred)
 * signs and pays the one-time verification fee to the SAID treasury.
 *
 * @param owner - The agent's wallet public key (used for PDA derivation)
 * @param authority - The agent identity's authority (signer + fee payer)
 * @returns The get_verified instruction
 */
export function buildGetVerifiedInstruction(
  owner: PublicKey,
  authority: PublicKey,
): TransactionInstruction {
  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: deriveAgentIdentityPda(owner), isSigner: false, isWritable: true },
      { pubkey: deriveTreasuryPda(), isSigner: false, isWritable: true },
      { pubkey: authority, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: anchorDiscriminator("get_verified"),
  });
}
