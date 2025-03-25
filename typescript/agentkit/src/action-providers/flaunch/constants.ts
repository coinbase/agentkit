import { Address, parseAbi, zeroAddress } from "viem";
import { base, baseSepolia } from "viem/chains";

interface Addresses {
  [chainId: number]: Address;
}

export const FastFlaunchZapAddress: Addresses = {
  [base.id]: zeroAddress, // FIXME: update with real address when deployed
  [baseSepolia.id]: "0x251e97446a7019E5DA4860d4CF47291321C693D0",
};

export const FlaunchPositionManagerAddress: Addresses = {
  [base.id]: "0x51Bba15255406Cfe7099a42183302640ba7dAFDC",
  [baseSepolia.id]: "0x9A7059cA00dA92843906Cb4bCa1D005cE848AFdC",
};

export const FAST_FLAUNCH_ZAP_ABI = [
  {
    type: "function",
    name: "flaunch",
    inputs: [
      {
        name: "_params",
        type: "tuple",
        internalType: "struct FastFlaunchZap.FastFlaunchParams",
        components: [
          {
            name: "name",
            type: "string",
            internalType: "string",
          },
          {
            name: "symbol",
            type: "string",
            internalType: "string",
          },
          {
            name: "tokenUri",
            type: "string",
            internalType: "string",
          },
          {
            name: "creator",
            type: "address",
            internalType: "address",
          },
        ],
      },
    ],
    outputs: [
      {
        name: "memecoin_",
        type: "address",
        internalType: "address",
      },
    ],
    stateMutability: "nonpayable",
  },
];

export const POSITION_MANAGER_ABI = parseAbi([
  "event PoolCreated(bytes32 indexed _poolId, address _memecoin, address _memecoinTreasury, uint256 _tokenId, bool _currencyFlipped, uint256 _flaunchFee, (string name, string symbol, string tokenUri, uint256 initialTokenFairLaunch, uint256 premineAmount, address creator, uint24 creatorFeeAllocation, uint256 flaunchAt, bytes initialPriceParams, bytes feeCalculatorParams) _params)",
]);
