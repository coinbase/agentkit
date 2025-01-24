import { CdpAction, CdpActionSchemaAny } from "../../cdp_action";

import { MorphoDepositAction } from "./deposit";
import { MorphoWithdrawAction } from "./withdraw";

/**
 * Retrieves all Morpho action instances.
 * WARNING: All new Morpho action classes must be instantiated here to be discovered.
 *
 * @returns - Array of Morpho action instances
 */
export function getAllMorphoActions(): CdpAction<CdpActionSchemaAny>[] {
  return [new MorphoDepositAction(), new MorphoWithdrawAction()];
}

export const MORPHO_ACTIONS = getAllMorphoActions();

export { MorphoDepositAction, MorphoWithdrawAction };
