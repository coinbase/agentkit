import { z } from "zod";
import { SolidityVersions } from "./constants";

/**
 * Input schema for address reputation check.
 */
export const AddressReputationSchema = z
  .object({
    address: z
      .string()
      .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address format")
      .describe("The Ethereum address to check"),
    network: z.string().describe("The network to check the address on"),
  })
  .strip()
  .describe("Input schema for address reputation check");

/**
 * Input schema for deploy contract action.
 */
export const DeployContractSchema = z
  .object({
    solidityVersion: z
      .enum(Object.keys(SolidityVersions) as [string, ...string[]])
      .describe("The solidity compiler version"),
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
 * Input schema for deploy NFT action
 */
export const DeployNftSchema = z
  .object({
    name: z.string().describe("The name of the NFT collection"),
    symbol: z.string().describe("The symbol of the NFT collection"),
    baseURI: z.string().describe("The base URI for the token metadata"),
  })
  .strip()
  .describe("Instructions for deploying an NFT collection");

/**
 * Input schema for deploy token action.
 */
export const DeployTokenSchema = z
  .object({
    name: z.string().describe("The name of the token"),
    symbol: z.string().describe("The token symbol"),
    totalSupply: z.custom<bigint>().describe("The total supply of tokens to mint"),
  })
  .strip()
  .describe("Instructions for deploying a token");

/**
 * Input schema for request faucet funds action.
 */
export const RequestFaucetFundsSchema = z
  .object({
    assetId: z.string().optional().describe("The optional asset ID to request from faucet"),
  })
  .strip()
  .describe("Instructions for requesting faucet funds");

/**
 * Input schema for trade action.
 */
export const TradeSchema = z
  .object({
    amount: z.custom<bigint>().describe("The amount of the from asset to trade"),
    fromAssetId: z.string().describe("The from asset ID to trade"),
    toAssetId: z.string().describe("The to asset ID to receive from the trade"),
  })
  .strip()
  .describe("Instructions for trading assets");
