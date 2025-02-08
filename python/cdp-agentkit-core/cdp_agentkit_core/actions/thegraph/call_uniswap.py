import os
from collections.abc import Callable
from typing import Dict, Optional

from pydantic import BaseModel, Field
from requests import post

from cdp_agentkit_core.actions import CdpAction

DESCRIPTION_PROMPT = "Call the subgraph API using provided GraphQL query and variables."


class GraphqlReq(BaseModel):
    query: str = Field(..., description="The GraphQL query string. Example: 'query { ... }'")
    variables: Optional[Dict[str, object]] = Field(
        None, description="Optional variables for the GraphQL query provided as a dictionary."
    )


def send_graphql_query_to_subgraph(subgraph_url, query, variables=None):
    query = query.replace("```graphql", "").replace("```", "").strip()
    print(f">>> Sending GraphQL query to Subgraph: {query} with variables: {variables}")

    # Prepare the request payload
    payload = {"query": query}
    if variables:
        payload["variables"] = variables

    # Send the GraphQL request to the Subgraph
    response = post(subgraph_url, json=payload)
    print("sent and returning output")
    print(response)
    # Check if the request was successful
    if response.status_code == 200:
        return response.json()
    else:
        print("Error:", response.text)
        return None


def call_subgraph(query, variables) -> object:
    graphql_api = os.getenv("GRAPHQL_API")
    if not graphql_api:
        raise ValueError("GRAPHQL_API environment variable is not set.")
    subgraph_url = f"https://gateway.thegraph.com/api/{graphql_api}/subgraphs/id/5zvR82QoaXYFyDEKLZ9t6v9adgnptxYpKpSbxtgVENFV"
    return send_graphql_query_to_subgraph(subgraph_url, query, variables)


class CallSubgraphAction(CdpAction):
    """Call the subgraph API action."""

    name: str = "call_subgraph"
    description: str = DESCRIPTION_PROMPT
    args_schema: type[BaseModel] | None = GraphqlReq
    func: Callable[..., object] = call_subgraph
