import json
import os
from collections.abc import Callable
from typing import Dict, Optional

from pydantic import BaseModel, Field
from requests import post

from cdp_agentkit_core.actions import CdpAction

DESCRIPTION_PROMPT = (
    "Call the Uniswap v3 subgraph API using a GraphQL query along with optional variables. "
    "This function facilitates fetching data such as pools, transactions, and liquidity metrics "
    "directly from the Uniswap protocol via The Graph API."
)
class GraphqlReq(BaseModel):
    query: str = Field(..., description="The GraphQL query string for uniswap v3. Example: 'query { ... }'")
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
    # Check if the request was successful
    if response.status_code == 200:
        data = response.json()
        json_data = json.dumps(data, indent=2)
        return json_data
    else:
        print("Error:", response.text)
        return None


def call_subgraph(query, variables) -> str:
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
    func: Callable[..., str] = call_subgraph
