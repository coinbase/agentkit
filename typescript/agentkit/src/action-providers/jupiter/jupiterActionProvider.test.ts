import {
  Connection
} from "@solana/web3.js";

import { SvmWalletProvider } from "../../wallet-providers/svmWalletProvider";
import { JupiterActionProvider } from "./jupiterActionProvider";


jest.mock("@solana/web3.js", () => ({
  ...jest.requireActual("@solana/web3.js"),
  Connection: jest.fn(),
  SendTransactionError: jest.fn().mockReturnValue({
    message: "Failed to send",
    toString: () => "Failed to send",
  }),
  VersionedTransaction: jest.fn().mockReturnValue({
    sign: jest.fn(),
  }),
  MessageV0: {
    compile: jest.fn().mockReturnValue({}),
  },
}));

jest.mock("@solana/spl-token", () => ({
  getAssociatedTokenAddress: jest.fn(),
  getMint: jest.fn(),
  getAccount: jest.fn(),
  createAssociatedTokenAccountInstruction: jest.fn(),
  createTransferCheckedInstruction: jest.fn(),
}));

jest.mock("../../wallet-providers/svmWalletProvider");

describe("JupiterActionProvider", () => {
  let actionProvider: JupiterActionProvider;
  let mockWallet: jest.Mocked<SvmWalletProvider>;
  let mockConnection: jest.Mocked<Connection>;

  it.todo("Implement Swap Tests")
});
