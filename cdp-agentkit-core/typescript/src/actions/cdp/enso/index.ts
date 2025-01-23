import { CdpAction, CdpActionSchemaAny } from "../cdp_action";
import { EnsoRouteAction } from "./actions/route";

/**
 * Retrieves all Enso action instances
 *
 * @returns Array of Enso action instances
 */
export function getAllEnsoActions(): CdpAction<CdpActionSchemaAny>[] {
  // eslint-disable-next-line prettier/prettier
  return [new EnsoRouteAction()];
}

export const ENSO_ACTIONS = getAllEnsoActions();

// Export individual actions for direct imports
// eslint-disable-next-line prettier/prettier
export { EnsoRouteAction };
