"""Tests for OpenGradient action provider."""

from unittest.mock import MagicMock, patch

import opengradient as og
import pytest
from pydantic import ValidationError

import coinbase_agentkit.action_providers.opengradient.constants as constants
from coinbase_agentkit.action_providers.opengradient.opengradient_action_provider import (
    opengradient_action_provider,
)
from coinbase_agentkit.action_providers.opengradient.schemas import (
    OpenGradientEthUsdtOneHourVolatilityForecast,
    OpenGradientPromptDobby,
    OpenGradientPromptQwen,
    OpenGradientSuiUsdt30MinReturnForecast,
    OpenGradientSuiUsdtSixHourReturnForecast,
)


def test_error_provider_init():
    """Test that the opengradient action provider will not intialize if no private key is provided."""
    with pytest.raises(ValueError) as excinfo:
        opengradient_action_provider()
    assert "OPENGRADIENT_PRIVATE_KEY" in str(excinfo.value)


@pytest.mark.usefixtures("mock_env")
def test_successful_provider_init():
    """Test that the opengradient action provider can be initialized correctly."""
    try:
        opengradient_action_provider()
    except Exception as e:
        pytest.fail(f"Action provider raised an exception: {e}")


def test_successful_eth_usdt_one_hour_volatility_schema():
    """Test that the OpenGradientEthUsdtOneHourVolatilityForecast schema can be initialized properly."""
    try:
        OpenGradientEthUsdtOneHourVolatilityForecast()
    except Exception as e:
        pytest.fail(f"Function raised an exception: {e}")


def test_successful_sui_usdt_six_hour_return_schema():
    """Test that the OpenGradientSuiUsdtSixHourReturnForecast schema can be initialized properly."""
    try:
        OpenGradientSuiUsdtSixHourReturnForecast()
    except Exception as e:
        pytest.fail(f"Function raised an exception: {e}")


def test_successful_sui_usdt_30_min_return_schema():
    """Test that the OpenGradientSuiUsdt30MinReturnForecast schema can be initialized properly."""
    try:
        OpenGradientSuiUsdt30MinReturnForecast()
    except Exception as e:
        pytest.fail(f"Function raised an exception: {e}")


def test_bad_prompt_dobby_schema():
    """Test that the OpenGradientPromptDobby schema fails with invalid arguments."""
    with pytest.raises(ValidationError):
        OpenGradientPromptDobby()


def test_successful_prompt_dobby_schema():
    """Test that the OpenGradientPromptDobby schema accepts valid arguments."""
    args = {"prompt": "Hello World"}
    schema = OpenGradientPromptDobby(**args)
    assert schema.prompt == args["prompt"]


def test_bad_prompt_qwen_schema():
    """Test that the OpenGradientPromptQwen schema fails with invalid arguments."""
    with pytest.raises(ValidationError):
        OpenGradientPromptQwen()


def test_successful_prompt_qwen_schema():
    """Test that the OpenGradientPromptQwen schema accepts valid arguments."""
    args = {"prompt": "Hello World"}
    schema = OpenGradientPromptQwen(**args)
    assert schema.prompt == args["prompt"]


@pytest.mark.usefixtures("mock_env")
def test_bad_read_eth_usdt_one_hour_volatility():
    """Test that the read_eth_usdt_one_hour_volatility_forecast method handles errors from the OpenGradient SDK properly."""
    with patch("opengradient.read_workflow_result") as mock_read:
        mock_read.side_effect = Exception("Failed to read workflow")

        provider = opengradient_action_provider()

        error_result = provider.read_eth_usdt_one_hour_volatility_forecast()

        assert "Error reading one_hour_eth_usdt_volatility workflow:" in error_result


@pytest.mark.usefixtures("mock_env")
def test_successful_read_eth_usdt_one_hour_volatility():
    """Test that read_eth_usdt_one_hour_volatility returns the expected result from the SDK."""
    mock_result = MagicMock()
    mock_result.numbers = {"Y": 0.0678}

    with patch("opengradient.read_workflow_result") as mock_read:
        mock_read.return_value = mock_result

        provider = opengradient_action_provider()
        result = provider.read_eth_usdt_one_hour_volatility_forecast()

        assert "6.7800000000%" in result
        assert constants.ETH_USDT_ONE_HOUR_VOLATILITY_ADDRESS in result

        mock_read.assert_called_once_with(constants.ETH_USDT_ONE_HOUR_VOLATILITY_ADDRESS)


@pytest.mark.usefixtures("mock_env")
def test_bad_read_sui_usdt_six_hour_return():
    """Test that the read_sui_usdt_six_hour_return_forecast method handles errors from the OpenGradient SDK properly."""
    with patch("opengradient.read_workflow_result") as mock_read:
        mock_read.side_effect = Exception("Failed to read workflow")

        provider = opengradient_action_provider()
        error_result = provider.read_sui_usdt_six_hour_return_forecast()

        assert "Error reading sui_usdt_six_hour_return_forecast workflow:" in error_result


@pytest.mark.usefixtures("mock_env")
def test_successful_read_sui_usdt_six_hour_return():
    """Test that read_sui_usdt_six_hour_return returns the expected result from the SDK."""
    mock_result = MagicMock()
    mock_result.numbers = {"destandardized_prediction": 0.0123}

    with patch("opengradient.read_workflow_result") as mock_read:
        mock_read.return_value = mock_result

        provider = opengradient_action_provider()
        result = provider.read_sui_usdt_six_hour_return_forecast()

        assert "1.2300000000%" in result
        assert constants.SUI_USDT_SIX_HOUR_FORECAST_ADDRESS in result

        mock_read.assert_called_once_with(constants.SUI_USDT_SIX_HOUR_FORECAST_ADDRESS)


@pytest.mark.usefixtures("mock_env")
def test_bad_read_sui_usdt_30_min_return():
    """Test that the read_sui_usdt_30_min_return_forecast method handles errors from the OpenGradient SDK properly."""
    with patch("opengradient.read_workflow_result") as mock_read:
        mock_read.side_effect = Exception("Failed to read workflow")

        provider = opengradient_action_provider()
        error_result = provider.read_sui_usdt_30_minute_return_forecast()

        assert "Error reading sui_usdt_30_minute_return_forecast workflow:" in error_result


@pytest.mark.usefixtures("mock_env")
def test_successful_read_sui_usdt_30_min_return():
    """Test that read_sui_usdt_30_min_return returns the expected result from the SDK."""
    mock_result = MagicMock()
    mock_result.numbers = {"destandardized_prediction": 0.0534}

    with patch("opengradient.read_workflow_result") as mock_read:
        mock_read.return_value = mock_result

        provider = opengradient_action_provider()
        result = provider.read_sui_usdt_30_minute_return_forecast()

        assert "5.3400000000%" in result
        assert constants.SUI_USDT_THIRTY_MIN_FORECAST_ADDRESS in result

        mock_read.assert_called_once_with(constants.SUI_USDT_THIRTY_MIN_FORECAST_ADDRESS)


@pytest.mark.usefixtures("mock_env")
def test_successful_prompt_dobby():
    """Test that the prompt_dobby function works correctly with valid inputs."""
    mock_response = MagicMock()
    mock_response.transaction_hash = "71C7656EC7ab88b098defB751B7401B5f6d8976F"
    mock_response.chat_output = {"content": "Sample model response"}
    test_args = {"prompt": "Test prompt"}

    with patch("opengradient.llm_chat") as mock_llm:
        mock_llm.return_value = mock_response

        provider = opengradient_action_provider()
        result = provider.prompt_dobby(test_args)

        assert "Sample model response" in result
        assert "0x71C7656EC7ab88b098defB751B7401B5f6d8976F" in result

        mock_llm.assert_called_once_with(
            model_cid=og.LLM.DOBBY_UNHINGED_3_1_8B,
            messages=[{"role": "user", "content": "Test prompt"}],
            max_tokens=constants.DEFAULT_MAX_TOKENS,
        )


@pytest.mark.usefixtures("mock_env")
def test_prompt_dobby_missing_content():
    """Test that the prompt_dobby function handles missing content in response properly."""
    mock_response = MagicMock()
    mock_response.transaction_hash = "123"
    mock_response.chat_output = {}

    test_args = {"prompt": "Test prompt"}

    with patch("opengradient.llm_chat") as mock_llm:
        mock_llm.return_value = mock_response

        provider = opengradient_action_provider()
        result = provider.prompt_dobby(test_args)

        assert "Error: 'content' was not found in the chat output for the dobby model" in result


@pytest.mark.usefixtures("mock_env")
def test_prompt_dobby_invalid_args():
    """Test that the prompt_dobby function handles invalid arguments properly."""
    test_args = {"temperature": 0.5}

    provider = opengradient_action_provider()
    result = provider.prompt_dobby(test_args)

    assert "Error prompting dobby model" in result


@pytest.mark.usefixtures("mock_env")
def test_successful_prompt_qwen():
    """Test that the prompt_qwen function works correctly with valid inputs."""
    mock_response = MagicMock()
    mock_response.transaction_hash = "71C7656EC7ab88b098defB751B7401B5f6d8976F"
    mock_response.chat_output = {"content": "Sample model response"}
    test_args = {"prompt": "Test prompt"}

    with patch("opengradient.llm_chat") as mock_llm:
        mock_llm.return_value = mock_response

        provider = opengradient_action_provider()
        result = provider.prompt_qwen(test_args)

        assert "Sample model response" in result
        assert "0x71C7656EC7ab88b098defB751B7401B5f6d8976F" in result

        mock_llm.assert_called_once_with(
            model_cid=og.LLM.QWEN_2_5_72B_INSTRUCT,
            messages=[{"role": "user", "content": "Test prompt"}],
            max_tokens=constants.DEFAULT_MAX_TOKENS,
        )


@pytest.mark.usefixtures("mock_env")
def test_prompt_qwen_missing_content():
    """Test that the prompt_qwen function handles missing content in response properly."""
    mock_response = MagicMock()
    mock_response.transaction_hash = "123"
    mock_response.chat_output = {}

    test_args = {"prompt": "Test prompt"}

    with patch("opengradient.llm_chat") as mock_llm:
        mock_llm.return_value = mock_response

        provider = opengradient_action_provider()
        result = provider.prompt_qwen(test_args)

        assert "Error: 'content' was not found in the chat output for the qwen model" in result


@pytest.mark.usefixtures("mock_env")
def test_prompt_qwen_invalid_args():
    """Test that the prompt_qwen function handles invalid arguments properly."""
    test_args = {"temperature": 0.5}

    provider = opengradient_action_provider()
    result = provider.prompt_qwen(test_args)

    assert "Error prompting qwen model" in result
