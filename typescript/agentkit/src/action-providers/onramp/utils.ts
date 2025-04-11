import type { GetOnrampUrlWithProjectIdParams, GetOnrampUrlWithSessionTokenParams } from "./types";
import { ONRAMP_BUY_URL, VERSION } from "./version";

/**
 * Builds a Coinbase Onramp buy URL using the provided parameters.
 *
 * @param props - Configuration options for the Onramp buy URL
 * @param props.projectId - A projectId generated in the Coinbase Developer Portal
 * @returns The generated Onramp buy URL
 */
export function getOnrampBuyUrl({
  projectId,
  ...props
}: GetOnrampUrlWithProjectIdParams | GetOnrampUrlWithSessionTokenParams) {
  const url = new URL(ONRAMP_BUY_URL);

  if (projectId !== undefined) {
    // Coinbase Onramp requires projectId to be passed as appId
    url.searchParams.append("appId", projectId);
  }

  for (const key of Object.keys(props) as Array<keyof typeof props>) {
    const value = props[key];
    if (value !== undefined) {
      if (["string", "number", "boolean"].includes(typeof value)) {
        url.searchParams.append(key, value.toString());
      } else {
        url.searchParams.append(key, JSON.stringify(value));
      }
    }
  }

  url.searchParams.append("sdkVersion", `onchainkit@${VERSION}`);

  url.searchParams.sort();

  return url.toString();
}

/**
 * Converts a network ID to an Onramp network ID.
 *
 * @param networkId - The network ID to convert
 * @returns The Onramp network ID or null if the network ID is not supported
 */
export const convertNetworkIdToOnrampNetworkId = (networkId: string): string | null => {
  switch (networkId) {
    case "base-mainnet":
      return "base";
    case "ethereum-mainnet":
      return "ethereum";
    case "polygon-mainnet":
      return "polygon";
    case "optimism-mainnet":
      return "optimism";
    case "arbitrum-mainnet":
      return "arbitrum";
    default:
      return null;
  }
};
