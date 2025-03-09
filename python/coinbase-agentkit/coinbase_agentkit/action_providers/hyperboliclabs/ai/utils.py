"""Utility functions for Hyperbolic AI services.

This module provides utility functions for handling AI service operations
such as saving generated images.
"""

import os
from typing import Any


def save_base64_image(base64_data: str, output_path: str) -> str:
    """Save base64 encoded image data to a file.

    Args:
        base64_data: The base64 encoded image string
        output_path: Path where to save the image

    Returns:
        str: The absolute path to the saved image file

    Raises:
        ValueError: If the base64 data is invalid
        OSError: If there's an error saving the file
    """
    try:
        import base64

        # Remove potential base64 header if present
        if ',' in base64_data:
            base64_data = base64_data.split(',')[1]

        # Decode the base64 string
        image_data = base64.b64decode(base64_data)

        # Ensure the directory exists
        os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)

        # Write the image data
        with open(output_path, 'wb') as f:
            f.write(image_data)

        return os.path.abspath(output_path)
    except base64.binascii.Error as e:
        raise ValueError(f"Invalid base64 data: {e}")
    except OSError as e:
        raise OSError(f"Error saving image file: {e}")


__all__ = [
    "save_base64_image",
] 