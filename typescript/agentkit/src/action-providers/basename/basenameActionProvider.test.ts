import { encodeFunctionData, namehash, parseEther } from "viem";

import { basenameActionProvider } from "./basenameActionProvider";
import {
  BASENAMES_REGISTRAR_CONTROLLER_ADDRESS_MAINNET,
  REGISTRATION_DURATION,
  L2_RESOLVER_ADDRESS_MAINNET,
  L2_RESOLVER_ABI,
  REGISTRAR_ABI,
  BASENAMES_REGISTRAR_CONTROLLER_ADDRESS_TESTNET,
  L2_RESOLVER_ADDRESS_TESTNET,
} from "./constants";
import { RegisterBasenameSchema } from "./schemas";
import { EvmWalletProvider } from "../../wallet-providers";
import { Coinbase } from "@coinbase/coinbase-sdk";

const MOCK_AMOUNT = "0.123";
const MOCK_BASENAME = "test-basename";

describe("Register Basename Input", () => {
  it("should successfully parse valid input", () => {
    const validInput = {
      amount: MOCK_AMOUNT,
      basename: MOCK_BASENAME,
    };

    const result = RegisterBasenameSchema.safeParse(validInput);

    expect(result.success).toBe(true);
    expect(result.data).toEqual(validInput);
  });

  it("should fail parsing empty input", () => {
    const emptyInput = {};
    const result = RegisterBasenameSchema.safeParse(emptyInput);

    expect(result.success).toBe(false);
  });
});

describe("Register Basename Action", () => {
  /**
   * This is the default network.
   */
  const NETWORK_ID = Coinbase.networks.BaseMainnet;

  /**
   * This is a 40 character hexadecimal string that requires lowercase alpha characters.
   */
  const ADDRESS_ID = "0xe6b2af36b3bb8d47206a129ff11d5a2de2a63c83";

  let mockWallet: jest.Mocked<EvmWalletProvider>;

  const actionProvider = basenameActionProvider();

  beforeEach(() => {
    mockWallet = {
      getAddress: jest.fn().mockReturnValue(ADDRESS_ID),
      getNetwork: jest.fn().mockReturnValue({ networkId: NETWORK_ID }),
      sendTransaction: jest.fn(),
      waitForTransactionReceipt: jest.fn(),
    } as unknown as jest.Mocked<EvmWalletProvider>;

    mockWallet.sendTransaction.mockResolvedValue("some-hash" as `0x${string}`);
    mockWallet.waitForTransactionReceipt.mockResolvedValue({});
  });

  it(`should Successfully respond with ${MOCK_BASENAME}.base.eth for network: ${Coinbase.networks.BaseMainnet}`, async () => {
    const args = {
      amount: MOCK_AMOUNT,
      basename: MOCK_BASENAME,
    };

    const name = `${MOCK_BASENAME}.base.eth`;

    mockWallet.getNetwork.mockReturnValue({
      protocolFamily: "evm",
      networkId: Coinbase.networks.BaseMainnet,
    });

    const response = await actionProvider.register(mockWallet, args);

    expect(mockWallet.sendTransaction).toHaveBeenCalledWith({
      to: BASENAMES_REGISTRAR_CONTROLLER_ADDRESS_MAINNET,
      data: encodeFunctionData({
        abi: REGISTRAR_ABI,
        functionName: "register",
        args: [
          {
            name: MOCK_BASENAME,
            owner: ADDRESS_ID,
            duration: REGISTRATION_DURATION,
            resolver: L2_RESOLVER_ADDRESS_MAINNET,
            data: [
              encodeFunctionData({
                abi: L2_RESOLVER_ABI,
                functionName: "setAddr",
                args: [namehash(name), ADDRESS_ID],
              }),
              encodeFunctionData({
                abi: L2_RESOLVER_ABI,
                functionName: "setName",
                args: [namehash(name), name],
              }),
            ],
            reverseRecord: true,
          },
        ],
      }),
      value: parseEther(MOCK_AMOUNT),
    });
    expect(mockWallet.waitForTransactionReceipt).toHaveBeenCalledWith("some-hash");
    expect(response).toContain(`Successfully registered basename ${MOCK_BASENAME}.base.eth`);
    expect(response).toContain(`for address ${ADDRESS_ID}`);
  });

  it(`should Successfully respond with ${MOCK_BASENAME}.basetest.eth for any other network`, async () => {
    const args = {
      amount: MOCK_AMOUNT,
      basename: MOCK_BASENAME,
    };

    const name = `${MOCK_BASENAME}.basetest.eth`;

    mockWallet.getNetwork.mockReturnValue({
      protocolFamily: "evm",
      networkId: "anything-else",
    });

    const response = await actionProvider.register(mockWallet, args);

    expect(mockWallet.sendTransaction).toHaveBeenCalledWith({
      to: BASENAMES_REGISTRAR_CONTROLLER_ADDRESS_TESTNET,
      data: encodeFunctionData({
        abi: REGISTRAR_ABI,
        functionName: "register",
        args: [
          {
            name: MOCK_BASENAME,
            owner: ADDRESS_ID,
            duration: REGISTRATION_DURATION,
            resolver: L2_RESOLVER_ADDRESS_TESTNET,
            data: [
              encodeFunctionData({
                abi: L2_RESOLVER_ABI,
                functionName: "setAddr",
                args: [namehash(name), ADDRESS_ID],
              }),
              encodeFunctionData({
                abi: L2_RESOLVER_ABI,
                functionName: "setName",
                args: [namehash(name), name],
              }),
            ],
            reverseRecord: true,
          },
        ],
      }),
      value: parseEther(MOCK_AMOUNT),
    });
    expect(mockWallet.waitForTransactionReceipt).toHaveBeenCalledWith("some-hash");
    expect(response).toContain(`Successfully registered basename ${MOCK_BASENAME}.basetest.eth`);
    expect(response).toContain(`for address ${ADDRESS_ID}`);
  });

  it("should fail with an error", async () => {
    const args = {
      amount: MOCK_AMOUNT,
      basename: MOCK_BASENAME,
    };

    const error = new Error("Failed to register basename");
    mockWallet.sendTransaction.mockRejectedValue(error);

    await actionProvider.register(mockWallet, args);

    expect(mockWallet.sendTransaction).toHaveBeenCalled();
    expect(`Error registering basename: ${error}`);
  });
});
