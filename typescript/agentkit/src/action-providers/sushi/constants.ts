import { parseAbi } from "viem";

export const routeProcessor5Abi_Route = parseAbi([
  "event Route(address indexed from, address to, address indexed tokenIn, address indexed tokenOut, uint256 amountIn, uint256 amountOutMin, uint256 amountOut)",
]);
