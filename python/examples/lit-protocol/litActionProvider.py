import os
from datetime import datetime, timedelta, timezone
from coinbase_agentkit import ActionProvider, WalletProvider, create_action
from pydantic import BaseModel
from typing import Any
from lit_python_sdk import connect

class LitActionSchema(BaseModel):
    magic_number: int

class LitActionProvider(ActionProvider[WalletProvider]):
    def __init__(self):
        super().__init__("lit-action-provider", [])
        self.client = connect()
        self.client.set_auth_token(os.getenv("EVM_PRIVATE_KEY"))
        self.client.new(lit_network="datil-test", debug=True)
        self.client.connect()

    @create_action(
        name="execute-lit-action",
        description="Execute a hello Lit Action with a magic number",
        schema=LitActionSchema
    )
    def execute_lit_action(self, wallet_provider: WalletProvider, args: dict[str, Any]) -> str:
        magic_number = args['magic_number']

        js_code = f"""
        (async () => {{
          const magicNumber = {magic_number};
          console.log("The magic number is:", magicNumber);
          Lit.Actions.setResponse({{ response: JSON.stringify({{ magicNumber }}) }});
        }})();
        """

        expiration = (datetime.now(timezone.utc) + timedelta(minutes=10)).strftime("%Y-%m-%dT%H:%M:%SZ")
        session_sigs_result = self.client.get_session_sigs(
            chain="ethereum",
            expiration=expiration,
            resource_ability_requests=[{
                "resource": {
                    "resource": "*",
                    "resourcePrefix": "lit-litaction",
                },
                "ability": "lit-action-execution",
            }]
        )
        session_sigs = session_sigs_result["sessionSigs"]

        result = self.client.execute_js(
            code=js_code,
            js_params={"magicNumber": magic_number},
            session_sigs=session_sigs
        )

        return f"Lit Action executed. Response: {result['response']}, Logs: {result['logs']}"

    def supports_network(self, network: Any) -> bool:
        return True

def lit_action_provider():
    return LitActionProvider()
