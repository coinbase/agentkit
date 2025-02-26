"""OpenGradient action provider."""

import os
from typing import Any

import opengradient as og

import coinbase_agentkit.action_providers.opengradient.constants as constants
from coinbase_agentkit.action_providers.opengradient.schemas import (
    OpenGradientBtcOneHourForecast,
    OpenGradientEthOneHourForecast,
    OpenGradientEthUsdtOneHourVolatilityForecast,
    OpenGradientPromptDobby,
    OpenGradientPromptQwen,
    OpenGradientSolOneHourForecast,
)
from coinbase_agentkit.action_providers.opengradient.utils import (
    create_block_explorer_link_smart_contract,
    create_block_explorer_link_transaction,
)

from ...network import Network
from ..action_decorator import create_action
from ..action_provider import ActionProvider


class OpenGradientActionProvider(ActionProvider):
    """Provides actions for interacting with OpenGradient."""

    def __init__(self, private_key: str | None = None):
        super().__init__("opengradient", [])

        private_key = private_key or os.getenv("OPENGRADIENT_PRIVATE_KEY")

        if not private_key:
            raise ValueError("OPENGRADIENT_PRIVATE_KEY is not configured.")

        try:
            self.client = og.init(private_key=private_key, email=None, password=None)
        except Exception as e:
            raise ValueError(f"Failed to initialize OpenGradient client: {e}") from e

    @create_action(
        name="read_eth_usdt_one_hour_volatility_forecast",
        description="""
This tool reads the latest ETH/USDT 1-hour volatility prediction from a smart-contract model deployment on the OpenGradient network.
The model forecasts the standard deviation of 1-minute returns for ETH/USDT over the next hour.

Inputs:
- The model's inputs are handled automatically by oracles - no user input is required.

Outputs:
- This function outputs a single float value representing the predicted standard deviation
- This function also outputs a link to block explorer for the smart contract where the model is deployed

Example output format (represents approximately .037% increase in volatility):
'0.0377415738%'
Block Explorer: https://explorer.opengradient.ai/address/0xFC5d8EDba288f9330Af324555F1A729303382725

Important notes:
- This is a read-only operation and will not modify any blockchain state
- The prediction is automatically updated hourly with the 10 most recent 3-minute OHLC candles from oracle-fed data
""",
        schema=OpenGradientEthUsdtOneHourVolatilityForecast,
    )
    def read_eth_usdt_one_hour_volatility_forecast(self, args: dict[str, Any]) -> str:
        """Read from the ETH/USDT one hour volatility forecast model workflow on the OpenGradient network.

        Args:
            args (dict[str, Any]): Input arguments for the action.

        Returns:
            str: A message containing the action response or error details.

        """
        try:
            contract_address = constants.ETH_USDT_ONE_HOUR_VOLATILITY_ADDRESS
            result = og.read_workflow_result(contract_address)

            formatted_result = format(float(result.numbers["Y"]), ".10%")
            block_explorer_link = create_block_explorer_link_smart_contract(
                constants.ETH_USDT_ONE_HOUR_VOLATILITY_ADDRESS
            )

            return f"{formatted_result}\nBlock Explorer: {block_explorer_link}"
        except Exception as e:
            return f"Error reading one_hour_eth_usdt_volatility workflow: {e!s}"

    @create_action(
        name="read_btc_one_hour_price_forecast",
        description="""
This tool reads the latest SUI/USDT 6-hour return forecast from a smart-contract model deployment on the OpenGradient network.
The model predicts the expected price return over the next 6 hours for the SUI/USDT trading pair.

Inputs:
- The model's inputs are handled automatically by oracles - no user input is required.

Outputs:
- This model outputs a single float value representing the predicted 6-hour return
- This function also outputs a link to block explorer for the smart contract where the model is deployed

Example output format (represents approximately -10.84% predicted return):
'-10.8388245106%'
Block Explorer: https://explorer.opengradient.ai/address/0x080881b65427Da162CA0995fB23710Db4E8d85Cb

Important notes:
- This is a read-only operation and will not modify any blockchain state
- The prediction is automatically updated with the 6 most recent 3-hour OHLC candles using oracle-fed data
""",
        schema=OpenGradientBtcOneHourForecast,
    )
    def read_btc_one_hour_price_forecast(self, args: dict[str, Any]) -> str:
        """Read from the SUI/USDT six hour return forecast workflow on the OpenGradient network.

        Args:
            args (dict[str, Any]): Input arguments for the action.

        Returns:
            str: A message containing the action response or error details.

        """
        try:
            contract_address = constants.BTC_ONE_HOUR_FORECAST_ADDRESS
            result = og.read_workflow_result(contract_address)

            formatted_result = format(float(result.numbers["regression_output"]), ".10%")
            block_explorer_link = create_block_explorer_link_smart_contract(
                constants.BTC_ONE_HOUR_FORECAST_ADDRESS
            )

            return f"{formatted_result}\nBlock Explorer: {block_explorer_link}"
        except Exception as e:
            return f"Error reading btc_one_hour_price_forecast workflow: {e!s}"

    @create_action(
        name="read_eth_one_hour_price_forecast",
        description="""
This tool reads the latest SUI/USDT 6-hour return forecast from a smart-contract model deployment on the OpenGradient network.
The model predicts the expected price return over the next 6 hours for the SUI/USDT trading pair.

Inputs:
- The model's inputs are handled automatically by oracles - no user input is required.

Outputs:
- This model outputs a single float value representing the predicted 6-hour return
- This function also outputs a link to block explorer for the smart contract where the model is deployed

Example output format (represents approximately -10.84% predicted return):
'-10.8388245106%'
Block Explorer: https://explorer.opengradient.ai/address/0x080881b65427Da162CA0995fB23710Db4E8d85Cb

Important notes:
- This is a read-only operation and will not modify any blockchain state
- The prediction is automatically updated with the 6 most recent 3-hour OHLC candles using oracle-fed data
""",
        schema=OpenGradientEthOneHourForecast,
    )
    def read_eth_one_hour_price_forecast(self, args: dict[str, Any]) -> str:
        """Read from the SUI/USDT six hour return forecast workflow on the OpenGradient network.

        Args:
            args (dict[str, Any]): Input arguments for the action.

        Returns:
            str: A message containing the action response or error details.

        """
        try:
            contract_address = constants.ETH_ONE_HOUR_FORECAST_ADDRESS
            result = og.read_workflow_result(contract_address)

            formatted_result = format(float(result.numbers["regression_output"]), ".10%")
            block_explorer_link = create_block_explorer_link_smart_contract(
                constants.ETH_ONE_HOUR_FORECAST_ADDRESS
            )

            return f"{formatted_result}\nBlock Explorer: {block_explorer_link}"
        except Exception as e:
            return f"Error reading eth_one_hour_price_forecast workflow: {e!s}"

    @create_action(
        name="read_sol_one_hour_price_forecast",
        description="""
This tool reads the latest SUI/USDT 6-hour return forecast from a smart-contract model deployment on the OpenGradient network.
The model predicts the expected price return over the next 6 hours for the SUI/USDT trading pair.

Inputs:
- The model's inputs are handled automatically by oracles - no user input is required.

Outputs:
- This model outputs a single float value representing the predicted 6-hour return
- This function also outputs a link to block explorer for the smart contract where the model is deployed

Example output format (represents approximately -10.84% predicted return):
'-10.8388245106%'
Block Explorer: https://explorer.opengradient.ai/address/0x080881b65427Da162CA0995fB23710Db4E8d85Cb

Important notes:
- This is a read-only operation and will not modify any blockchain state
- The prediction is automatically updated with the 6 most recent 3-hour OHLC candles using oracle-fed data
""",
        schema=OpenGradientSolOneHourForecast,
    )
    def read_sol_one_hour_price_forecast(self, args: dict[str, Any]) -> str:
        """Read from the SUI/USDT six hour return forecast workflow on the OpenGradient network.

        Args:
            args (dict[str, Any]): Input arguments for the action.

        Returns:
            str: A message containing the action response or error details.

        """
        try:
            contract_address = constants.SOL_ONE_HOUR_FORECAST_ADDRESS
            result = og.read_workflow_result(contract_address)

            formatted_result = format(float(result.numbers["regression_output"]), ".10%")
            block_explorer_link = create_block_explorer_link_smart_contract(
                constants.SOL_ONE_HOUR_FORECAST_ADDRESS
            )

            return f"{formatted_result}\nBlock Explorer: {block_explorer_link}"
        except Exception as e:
            return f"Error reading sol_one_hour_price_forecast workflow: {e!s}"

    @create_action(
        name="prompt_dobby",
        description="""
This tool generates responses using the Dobby-Mini-Unhinged-Llama-3.1-8B model through the OpenGradient blockchain network.
Dobby is a language model with a focus on crypto-positive and pro-freedom responses.
Do not use this tool for other LLM models or prompt formats.

Always return this functions results exactly as-is.

Inputs:
- prompt: String containing the input prompt for the model

Output:
- Returns a string containing just the model's response text
- Returns a link to the block explorer for the transaction that facilitated this inference

Important notes:
- The model has strong inherent biases towards:
  - Pro-cryptocurrency narratives
  - Personal freedom and decentralization
  - Direct, unfiltered communication style
- Response content may include strong opinions and informal language
- The default maximum token length is 4096
""",
        schema=OpenGradientPromptDobby,
    )
    def prompt_dobby(self, args: dict[str, Any]) -> str:
        """Prompts the Dobby-unhinged-8B model on the OpenGradient network.

        Args:
            args (dict[str, Any]): Input arguments for the action.

        Returns:
            str: A message containing the action response or error details.

        """
        try:
            prompt = args["prompt"]

            message = [
                {
                    "role": "user",
                    "content": prompt,
                }
            ]

            llm_output = og.llm_chat(
                model_cid=og.LLM.DOBBY_UNHINGED_3_1_8B,
                messages=message,
                max_tokens=constants.DEFAULT_MAX_TOKENS,
            )

            block_explorer_link = create_block_explorer_link_transaction(
                "0x" + llm_output.transaction_hash
            )
            chat_output = llm_output.chat_output.get(
                "content", "Error: 'content' was not found in the chat output for the dobby model"
            )
            return f"{chat_output}\nBlock Explorer: {block_explorer_link}"
        except Exception as e:
            return f"Error prompting dobby model: {e!s}"

    @create_action(
        name="prompt_qwen",
        description="""
This tool generates responses using the Qwen2.5-72B-Instruct model through the OpenGradient blockchain network.
Qwen is a language model with strong capabilities in coding, mathematics, and multilingual tasks.
Do not use this tool for other LLM models or prompt formats.

Always return this functions results exactly as-is.

Inputs:
- prompt: String containing the input prompt for the model

Output:
- Returns a string containing the model's response text
- Returns a link to the block explorer for the transaction that facilitated this inference

Important notes:
- Model excels at:
 - Complex coding tasks and mathematical reasoning
 - Structured data understanding and JSON generation
 - Multilingual responses across 29+ languages
- The default maximum token length is 4096
""",
        schema=OpenGradientPromptQwen,
    )
    def prompt_qwen(self, args: dict[str, Any]) -> str:
        """Prompts the Qwen-2.5-72B model on the OpenGradient network.

        Args:
            args (dict[str, Any]): Input arguments for the action.

        Returns:
            str: A message containing the action response or error details.

        """
        try:
            prompt = args["prompt"]

            message = [
                {
                    "role": "user",
                    "content": prompt,
                }
            ]

            llm_output = og.llm_chat(
                model_cid=og.LLM.QWEN_2_5_72B_INSTRUCT,
                messages=message,
                max_tokens=constants.DEFAULT_MAX_TOKENS,
            )

            block_explorer_link = create_block_explorer_link_transaction(
                "0x" + llm_output.transaction_hash
            )
            chat_output = llm_output.chat_output.get(
                "content", "Error: 'content' was not found in the chat output for the qwen model"
            )
            return f"{chat_output}\nBlock Explorer: {block_explorer_link}"
        except Exception as e:
            return f"Error prompting qwen model: {e!s}"

    def supports_network(self, network: Network) -> bool:
        """Check if network is supported by OpenGradient actions.

        Args:
            network (Network): The network to check support for.

        Returns:
            True (bool): These OpenGradient operations support all networks.

        """
        return True


def opengradient_action_provider() -> OpenGradientActionProvider:
    """Create a new OpenGradient action provider.

    Returns:
        OpenGradientProvider: A new OpenGradient action provider instance.

    """
    return OpenGradientActionProvider()
