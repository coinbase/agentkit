import { parseAbi } from "viem";

export const routeProcessor9Abi_Route = parseAbi([
  "event Route(address indexed from, address to, address indexed tokenIn, address tokenOut, uint256 amountIn, uint256 amountOut, int256 slippage, uint32 indexed referralCode, bytes32 diagnosticsFirst32)",
]);
