/**
 * This module provides functionality to post a cast on Farcaster.
 */

import { z } from "zod";
import { FarcasterAction } from "./farcaster_action";

/**
 * Prompt message describing the post cast tool.
 * A successful response will return a message with the API response in JSON format,
 * while a failure response will indicate an error from the Farcaster API.
 */
const POST_CAST_PROMPT = `
This tool will post a cast to Farcaster. The tool takes the text of the cast as input. Casts can be maximum 280 characters.

A successful response will return a message with the API response as a JSON payload:
    {}

A failure response will return a message with the Farcaster API request error:
    You are not allowed to post a cast with duplicate content.
`;

/**
 * Input argument schema for the post cast action.
 */
export const PostCastInput = z
  .object({
    castText: z.string().max(280, "Cast text must be a maximum of 280 characters."),
  })
  .strip()
  .describe("Input schema for posting a text-based cast");

/**
 * Posts a cast on Farcaster.
 *
 * @param args - The input arguments for the action.
 * @returns A message indicating the success or failure of the cast posting.
 */
export async function postCast(args: z.infer<typeof PostCastInput>): Promise<string> {
  try {
    const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY;
    const SIGNER_UUID = process.env.NEYNAR_MANAGED_SIGNER;

    const headers: HeadersInit = {
      api_key: NEYNAR_API_KEY!,
      "Content-Type": "application/json",
    };

    const response = await fetch("https://api.neynar.com/v2/farcaster/cast", {
      method: "POST",
      headers,
      body: JSON.stringify({
        signer_uuid: SIGNER_UUID,
        text: args.castText,
      }),
    });
    const data = await response.json();
    return `Successfully posted cast to Farcaster:\n${JSON.stringify(data)}`;
  } catch (error) {
    return `Error posting to Farcaster:\n${error}`;
  }
}

/**
 * Post Cast Action
 */
export class FarcasterPostCastAction implements FarcasterAction<typeof PostCastInput> {
  public name = "farcaster_post_cast";
  public description = POST_CAST_PROMPT;
  public argsSchema = PostCastInput;
  public func = postCast;
}
