import { GraphQLClient } from "graphql-request";
import { getAccountOutflowQuery } from "./queries";
import { BASE_GRAPH_ENDPOINT } from "./endpoints";
import { SuperfluidAccountResponse } from "./types";

const client = new GraphQLClient(BASE_GRAPH_ENDPOINT);

/**
 * Gets the current account outflows for the user
 *
 * @param userId - The user id of the account
 * @returns The data on the current streams from the agent
 */
export async function getAccountOutflow(
  userId: string,
): Promise<SuperfluidAccountResponse | undefined> {
  try {
    const variables = { id: userId.toLowerCase() };
    const data = await client.request<SuperfluidAccountResponse>(getAccountOutflowQuery, variables);
    return data;
  } catch (error) {
    console.error("Error fetching account data:", error);
    return undefined;
  }
}
