/**
 * This module exports various Farcaster action instances and their associated types.
 */

import { FarcasterAction, FarcasterActionSchemaAny } from "./farcaster_action";
import { FarcasterAccountDetailsAction } from "./account_details";
import { FarcasterPostCastAction } from "./post_cast";

/**
 * Retrieve an array of Farcaster action instances.
 *
 * @returns {FarcasterAction<FarcasterActionSchemaAny>[]} An array of Farcaster action instances.
 */
export function getAllFarcasterActions(): FarcasterAction<FarcasterActionSchemaAny>[] {
  return [new FarcasterAccountDetailsAction(), new FarcasterPostCastAction()];
}

/**
 * All available Farcaster actions.
 */
export const FARCASTER_ACTIONS = getAllFarcasterActions();

/**
 * All Farcaster action types.
 */
export {
  FarcasterAction,
  FarcasterActionSchemaAny,
  FarcasterAccountDetailsAction,
  FarcasterPostCastAction,
};
