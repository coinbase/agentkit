import { CdpAction, CdpActionSchemaAny } from "../../cdp_action";
import { PythFetchPriceAction } from "./fetch_price";
import { PythFetchPriceFeedIDAction } from "./fetch_price_feed_id";
export * from "./fetch_price_feed_id";
export * from "./fetch_price";

/**
 * Retrieves all Pyth Network action instances.
 * WARNING: All new Pyth action classes must be instantiated here to be discovered.
 *
 * @returns Array of Pyth Network action instances
 */
export function getAllPythActions(): CdpAction<CdpActionSchemaAny>[] {
  // eslint-disable-next-line prettier/prettier
  return [new PythFetchPriceFeedIDAction(), new PythFetchPriceAction()];
}

export const PYTH_ACTIONS = getAllPythActions();

// Export individual actions for direct imports
// eslint-disable-next-line prettier/prettier
export { PythFetchPriceFeedIDAction, PythFetchPriceAction };
