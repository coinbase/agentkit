"""Utility functions for Hyperbolic AI services.

This module provides utility functions for handling AI service operations
such as saving generated data.
"""

import base64
import os


def save_base64_data(base64_data: str, output_path: str) -> str:
    """Save base64 encoded data to a file.

    Args:
        base64_data: The base64 encoded data string
        output_path: Path where to save the file

    Returns:
        str: The absolute path to the saved file

    Raises:
        ValueError: If the base64 data is invalid
        OSError: If there's an error saving the file

    """
    try:
        if "," in base64_data:
            base64_data = base64_data.split(",")[1]

        decoded_data = base64.b64decode(base64_data)
        os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)

        with open(output_path, "wb") as f:
            f.write(decoded_data)

        return os.path.abspath(output_path)
    except base64.binascii.Error as e:
        raise ValueError(f"Invalid base64 data: {e!s}") from e
    except OSError as e:
        raise OSError(f"Error saving file: {e!s}") from e


def save_text(text: str, output_path: str) -> str:
    """Save text data to a file and return a preview.

    Args:
        text: The text to save
        output_path: Path where to save the text file

    Returns:
        str: The absolute path to the saved text file

    Raises:
        OSError: If there's an error saving the file

    """
    try:
        os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(text)

        return os.path.abspath(output_path)
    except OSError as e:
        raise OSError(f"Error saving text file: {e!s}") from e


__all__ = [
    "save_base64_data",
    "save_text",
]
