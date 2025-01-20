import { CdpAction } from "./cdp_action";
import { Wallet, Amount } from "@coinbase/coinbase-sdk";
import { z } from "zod";

const DEPLOY_CONTRACT_PROMPT = `
This tool will deploy an arbitrary smart contract. It takes 3 required arguments: solidity compiler version which is a string, solidity input json which is a string, 
contract name which is a string, and 1 optional argument: constructor arguments which is a map of string to any.
The solidity version must be 0.8.+, such as "0.8.28+commit.7893614a" which is the latest version. See https://binaries.soliditylang.org/bin/list.json for valid versions.
The input json must be a valid solidity input json. See https://docs.soliditylang.org/en/latest/using-the-compiler.html#input-description for more details. If you 
depend on a library, make sure to include the library source code as separate sources inline in the input json.
For the settings outputSelection in the input JSON, make sure to have a string array including the abi and evm.bytecode.
The contract name must be the name of the contract class to be deployed.
The constructor arguments, if passed in, must be a map of constructor arguments for the contract, where the key is the argument name and the value is the argument value.
uint, int, bytes, fixed bytes, string, address should be encoded as strings. Boolean values should be encoded as true or false.
For arrays and tuples, the values should be encoded depending on the underlying type contained in the array or tuple.
`;

/**
 * Input schema for deploy contract action.
 */
export const DeployContractInput = z
  .object({
    solidityVersion: z.string().describe("The solidity compiler version"),
    solidityInputJson: z.string().describe("The input json for the solidity compiler"),
    contractName: z.string().describe("The name of the contract class to be deployed"),
    constructorArgs: z
      .record(z.string(), z.any())
      .describe("The constructor arguments for the contract")
      .optional(),
  })
  .strip()
  .describe("Instructions for deploying an arbitrary contract");

/**
 * Deploys an arbitrary contract.
 *
 * @param wallet - The wallet to deploy the contract from.
 * @param args - The input arguments for the action. The four required fields are solidityVersion, solidityInputJson, contractName, and constructorArgs.
 * @returns A message containing the deployed contract address and details.
 */
export async function deployContract(
  wallet: Wallet,
  args: z.infer<typeof DeployContractInput>,
): Promise<string> {
  try {
    const contract = await wallet.deployContract({
      solidityVersion: args.solidityVersion,
      solidityInputJson: args.solidityInputJson,
      contractName: args.contractName,
      constructorArgs: args.constructorArgs ?? {},
    });

    const result = await contract.wait();

    return `Deployed contract ${args.contractName} at address ${result.getContractAddress()}. Transaction link: ${result
      .getTransaction()!
      .getTransactionLink()}`;
  } catch (error) {
    return `Error deploying contract: ${error}`;
  }
}

/**
 * Deploy contract action.
 */
export class DeployContractAction implements CdpAction<typeof DeployContractInput> {
  public name = "deploy_contract";
  public description = DEPLOY_CONTRACT_PROMPT;
  public argsSchema = DeployContractInput;
  public func = deployContract;
}
