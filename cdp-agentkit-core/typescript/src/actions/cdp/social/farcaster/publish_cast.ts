/**
 * This module provides functionality to publish a cast on Farcaster.
 */

import { z } from "zod";
import { FarcasterAction } from "./farcaster_action";

/**
 * Prompt message describing the publish cast tool.
 * A successful response will return a message with the API response in JSON format,
 * while a failure response will indicate an error from the Farcaster API.
 */
const PUBLISH_CAST_PROMPT = `
This tool will publish a cast to Farcaster. The tool takes the text of the cast as input. Casts can be maximum 280 characters.

A successful response will return a message with the API response as a JSON payload:
    {}

A failure response will return a message with the Farcaster API request error:
    You are not allowed to publish a cast with duplicate content.
`;

/**
 * Input argument schema for the publish cast action.
 */
export const PublishCastInput = z
  .object({
    castText: z.string().max(280, "Cast text must be a maximum of 280 characters."),
  })
  .strip()
  .describe("Input schema for publishing a text-based cast");

/**
 * Publishes a cast on Farcaster.
 *
 * @param args - The input arguments for the action.
 * @returns A message indicating the success or failure of the cast publishing.
 */
export async function publishCast(args: z.infer<typeof PublishCastInput>): Promise<string> {
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
    return `Successfully published cast to Farcaster:\n${JSON.stringify(data)}`;
  } catch (error) {
    return `Error publishing to Farcaster:\n${error}`;
  }
}

/**
 * Publish Cast Action
 */
export class PublishCastAction implements FarcasterAction<typeof PublishCastInput> {
  public name = "publish_cast";
  public description = PUBLISH_CAST_PROMPT;
  public argsSchema = PublishCastInput;
  public func = publishCast;
}
