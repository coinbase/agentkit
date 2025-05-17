import { Hex } from "viem";
import { Contract, Connection, Account } from "@near-js/accounts";
import { actionCreators, Action as NearAction } from "@near-js/transactions";

import { NEAR_MAX_GAS } from "../constants";

export interface SignArgs {
  payload: number[];
  path: string;
  key_version: number;
}

export interface MPCSignature {
  big_r: string;
  big_s: string;
  recoveryId: number;
}

export interface TransactionWithSignature {
  transaction: Hex;
  signature: MPCSignature;
}

export interface ChangeMethodArgs<T> {
  args: T;
  gas: string;
  attachedDeposit: string;
}

export interface MpcContractInterface extends Contract {
  experimental_signature_deposit: () => Promise<string>;
  sign: (args: ChangeMethodArgs<SignArgs>) => Promise<MPCSignature>;
}

/**
 *
 */
export class MpcContract {
  contract: MpcContractInterface;
  connectedAccount: Account;
  contractId: string;

  /**
   * Create a new MPC contract instance
   *
   * @param connection - Near connection
   * @param contractId - The MPC contract ID
   *
   * @returns A new MPC contract instance
   */
  constructor(connection: Connection, contractId: string) {
    this.connectedAccount = new Account(connection, contractId);
    this.contractId = contractId;
    this.contract = new Contract(connection, contractId, {
      changeMethods: ["sign"],
      viewMethods: ["experimental_signature_deposit"],
      useLocalViewExecution: false,
    }) as MpcContractInterface;
  }

  /**
   * Get the experimental signature deposit from the MPC contract instance
   *
   * @returns The experimental signature deposit
   */
  public async getExperimentalSignatureDeposit(): Promise<string> {
    return this.contract.experimental_signature_deposit();
  }

  /**
   * Get the sign action from the MPC contract instance
   *
   * @param signArgs - The sign arguments
   *
   * @returns The sign action
   */
  public async getSignAction(signArgs: SignArgs): Promise<NearAction> {
    const signatureDeposit = await this.getExperimentalSignatureDeposit();

    return actionCreators.functionCall(
      "sign",
      {
        request: signArgs,
      },
      NEAR_MAX_GAS.toString(),
      signatureDeposit,
    );
  }
}
