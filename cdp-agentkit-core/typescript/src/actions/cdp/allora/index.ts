/**
 * This module exports various Allora action instances and their associated types.
 */

import { AlloraAction, AlloraActionSchemaAny } from "./allora_action";
import { GetPriceInferenceAction } from "./get_price_inference";
import { GetAllTopicsAction } from "./get_all_topics";
/**
 * Retrieve an array of Allora action instances.
 *
 * @returns {AlloraAction<AlloraActionSchemaAny>[]} An array of Allora action instances.
 */
export function getAllAlloraActions(): AlloraAction<AlloraActionSchemaAny>[] {
  return [new GetPriceInferenceAction(), new GetAllTopicsAction()];
}

/**
 * All available Allora actions.
 */
export const ALLORA_ACTIONS = getAllAlloraActions();

/**
 * All Allora action types.
 */
export { AlloraAction, AlloraActionSchemaAny, GetPriceInferenceAction, GetAllTopicsAction };
