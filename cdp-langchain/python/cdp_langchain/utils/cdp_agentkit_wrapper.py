"""Util that calls CDP."""

import inspect
import json
from collections.abc import Callable
from typing import Any

from langchain_core.utils import get_from_dict_or_env
from pydantic import BaseModel, model_validator

from cdp import MnemonicSeedPhrase, Wallet
from cdp_langchain import __version__
from cdp_langchain.constants import CDP_LANGCHAIN_DEFAULT_SOURCE


class CdpAgentkitWrapper(BaseModel):
    """Wrapper for CDP Agentkit Core."""

    wallet: Any = None  #: :meta private:
    cdp_api_key_name: str | None = None
    cdp_api_key_private_key: str | None = None
    network_id: str | None = None

    @model_validator(mode="before")
    @classmethod
    def validate_environment(cls, values: dict) -> Any:
        """Validate that CDP API Key and python package exists in the environment and configure the CDP SDK."""
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
            source=CDP_LANGCHAIN_DEFAULT_SOURCE,
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

    def export_wallet(self) -> dict[str, str]:
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
