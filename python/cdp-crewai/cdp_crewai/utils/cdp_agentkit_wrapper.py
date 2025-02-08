"""Util that calls CDP."""

import json
from collections.abc import Callable
from typing import Any, Dict, List, Optional
import inspect

from langchain.utils import get_from_dict_or_env
from pydantic import BaseModel, model_validator

from cdp import Cdp, Wallet, WalletData
from cdp import MnemonicSeedPhrase, Wallet
from cdp_agentkit_core.actions import CDP_ACTIONS
from cdp_crewai.constants import CDP_CREWAI_DEFAULT_SOURCE
from cdp_crewai import __version__

CDP_CREWAI_DEFAULT_SOURCE = "cdp-crewai"
__version__ = "0.0.1"

class CdpAgentkitWrapper(BaseModel):
    """Wrapper for CDP AgentKit to be used with CrewAI tools."""

    wallet: Any = None  #: :meta private:
    cdp_api_key_name: str | None = None
    cdp_api_key_private_key: str | None = None
    network_id: str | None = None
    
    @model_validator(mode="before")
    @classmethod
    def validate_environment(cls, values: dict) -> Any:
        """Validate CDP configuration and initialize SDK."""
        cdp_api_key_name = get_from_dict_or_env(values, "cdp_api_key_name", "CDP_API_KEY_NAME")
        cdp_api_key_private_key = get_from_dict_or_env(
            values, "cdp_api_key_private_key", "CDP_API_KEY_PRIVATE_KEY"
        ).replace("\\n", "\n")
        mnemonic_phrase = get_from_dict_or_env(values, "mnemonic_phrase", "MNEMONIC_PHRASE", "")
        network_id = get_from_dict_or_env(values, "network_id", "NETWORK_ID", "base-sepolia")
        wallet_data_json = values.get("cdp_wallet_data")

        try:
            from cdp import Cdp, Wallet, WalletData
        except Exception:
            raise ImportError(
                "CDP SDK is not installed. " "Please install it with `pip install cdp-sdk`"
            ) from None

        Cdp.configure(
            api_key_name=cdp_api_key_name,
            private_key=cdp_api_key_private_key,
            source=CDP_CREWAI_DEFAULT_SOURCE,
            source_version=__version__,
        )

        if wallet_data_json:
            wallet_data = WalletData.from_dict(json.loads(wallet_data_json))
            wallet = Wallet.import_data(wallet_data)
        elif mnemonic_phrase:
            phrase = MnemonicSeedPhrase(mnemonic_phrase)
            wallet = Wallet.import_wallet(phrase, network_id)
        else:
            wallet = Wallet.create(network_id=network_id)

        values["wallet"] = wallet
        values["cdp_api_key_name"] = cdp_api_key_name
        values["cdp_api_key_private_key"] = cdp_api_key_private_key
        values["mnemonic_phrase"] = mnemonic_phrase
        values["network_id"] = network_id

        return values

    def get_wallet_info(self) -> str:
        """Get information about the current wallet."""
        return f"Wallet address: {self.wallet.address}"

    def transfer_eth(self, to_address: str, amount: float) -> str:
        """Transfer ETH to a specified address."""
        tx = self.wallet.transfer_eth(to_address=to_address, amount=amount)
        return f"Transferred {amount} ETH to {to_address}. Transaction hash: {tx.hash}"

    def export_wallet(self) -> str:
        """Export wallet data required to re-instantiate the wallet.

        Returns:
            str: The json string of wallet data including the wallet_id and seed.
        """
        wallet_data_dict = self.wallet.export_data().to_dict()
        wallet_data_dict["default_address_id"] = self.wallet.default_address.address_id
        return json.dumps(wallet_data_dict)

    def run_action(self, func: Callable[..., str], **kwargs) -> str:
        """Run a CDP Action."""
        func_signature = inspect.signature(func)
        first_kwarg = next(iter(func_signature.parameters.values()), None)

        if first_kwarg and first_kwarg.annotation is Wallet:
            return func(self.wallet, **kwargs)
        else:
            return func(**kwargs)

    # # Add all CDP actions dynamically
    # for action in CDP_ACTIONS:
    #     locals()[action.name] = action.function 