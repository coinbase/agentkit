import os
from typing import Any

import requests
import uvicorn
from dotenv import load_dotenv
from fastapi import FastAPI
from pydantic import BaseModel, ConfigDict, Field, field_validator
from strands import Agent
from strands_tools import generate_image as generate_image_tool
from x402.fastapi.middleware import require_payment
from x402.types import EIP712Domain, TokenAmount, TokenAsset

# Load environment variables
load_dotenv()

# Get configuration from environment - properly use environment variable
ADDRESS = os.getenv("ADDRESS")  # Receiving Payment address
OPENWEATHER_API_KEY = os.getenv("OPENWEATHER_API_KEY")  # OpenWeather API key
# Use environment variable or default to localhost for security
HOST = os.getenv("HOST", "127.0.0.1")  # Defaults to localhost
PORT = int(os.getenv("PORT", 4021))

if not ADDRESS:
    raise ValueError("Missing required environment variable: ADDRESS")


# Define Pydantic models for request/response validation


class ContentRequest(BaseModel):
    """Request model for content generation."""

    query: str = Field(
        ...,
        min_length=1,
        max_length=1000,
        description="The prompt describing what images to generate",
    )

    @field_validator("query")
    @classmethod
    def validate_query(cls, v):
        """Validate that query is not empty or whitespace only."""
        if not v.strip():
            raise ValueError("Query cannot be empty or whitespace only")
        return v.strip()

    model_config = ConfigDict(
        json_schema_extra={"example": {"query": "Generate 3 images of a sunset over mountains"}}
    )


class WeatherRequest(BaseModel):
    """Request model for weather data."""

    city: str = Field(
        ..., min_length=1, max_length=100, description="City name (e.g., 'London' or 'London,UK')"
    )
    units: str | None = Field(
        default="metric", description="Units of measurement: 'metric', 'imperial', or 'standard'"
    )

    @field_validator("city")
    @classmethod
    def validate_city(cls, v):
        """Validate that city is not empty."""
        if not v.strip():
            raise ValueError("City cannot be empty or whitespace only")
        return v.strip()

    @field_validator("units")
    @classmethod
    def validate_units(cls, v):
        """Validate that units are valid."""
        if v not in ["metric", "imperial", "standard"]:
            raise ValueError("Units must be metric, imperial, or standard")
        return v

    model_config = ConfigDict(
        json_schema_extra={"example": {"city": "London,UK", "units": "metric"}}
    )


# image genration function
def create_images_with_agent(query: str) -> str:
    """Generate images using the artist agent.

    Args:
        query: The prompt describing what images to generate

    Returns:
        Comma-separated list of file paths to generated images

    """
    # Artist agent that generates images based on prompts
    artist = Agent(
        tools=[generate_image_tool],
        system_prompt=(
            "You will be instructed to generate a number of images of a given subject. "
            "Vary the prompt for each generated image to create a variety of options. "
            "Your final output must contain ONLY a comma-separated list of the file system "
            "paths of generated images with a preamble telling the user the files are saved"
        ),
    )

    result = artist(query)
    return result


# weather generation function using OpenWeather
def get_weather_data(city: str, units: str = "metric") -> dict[str, Any]:
    """Fetch weather data from OpenWeather API.

    Args:
        city: City name
        units: Units of measurement (metric, imperial, or standard)

    Returns:
        Weather data from OpenWeather API

    Raises:
        HTTPException: If the API request fails

    """
    base_url = "https://api.openweathermap.org/data/2.5/weather"
    params = {"q": city, "appid": OPENWEATHER_API_KEY, "units": units}

    try:
        response = requests.get(base_url, params=params, timeout=(30, 30))
        response.raise_for_status()  # Raise an exception for HTTP errors (4xx or 5xx)
        weather_data = response.json()
        return weather_data
    except requests.exceptions.Timeout:
        print(f"Timeout error fetching weather data for {city}")
        return f"Timeout error fetching weather data for {city}"
    except requests.exceptions.RequestException as e:
        print(f"Error fetching weather data: {e}")
        return f"Error fetching weather data: {e}"


# Initialize FastAPI app
app = FastAPI(
    title="Payment-Gated API",
    description="API with payment requirements for different endpoints",
    version="1.0.0",
)


# Apply payment middleware to image generator endpoint
app.middleware("http")(
    require_payment(
        path="/image_generator",
        price=TokenAmount(
            amount="100",
            asset=TokenAsset(
                address="0x036CbD53842c5426634e7929541eC2318f3dCF7e",
                decimals=6,
                eip712=EIP712Domain(name="USDC", version="2"),
            ),
        ),
        pay_to_address=ADDRESS,
        network="base-sepolia",
        description="Image generation service",
        input_schema={
            "body_type": "json",
            "body_fields": {
                "query": {
                    "type": "string",
                    "description": "The prompt describing what images to generate (e.g., 'Generate 3 images of a sunset over mountains')",
                    "required": True,
                }
            },
        },
        output_schema={
            "type": "object",
            "properties": {
                "success": {
                    "type": "boolean",
                    "description": "Whether the image generation was successful",
                },
                "content": {
                    "type": "string",
                    "description": "Comma-separated list of file paths to generated images",
                },
                "error": {"type": "string", "description": "Error message if success is false"},
            },
        },
    )
)


# Apply payment middleware to weather endpoint
app.middleware("http")(
    require_payment(
        path="/weather",
        price="$0.001",
        pay_to_address=ADDRESS,
        network="base-sepolia",
        description="weather generation service",
        input_schema={
            "body_type": "json",
            "body_fields": {
                "query": {
                    "type": "string",
                    "description": "The prompt describing what images to generate",
                    "example": "Generate 3 images of a sunset over mountains",
                    "required": True,
                    "minLength": 1,
                    "maxLength": 500,
                }
            },
        },
    )
)


@app.get("/")
async def root() -> dict[str, str]:
    """Root endpoint with API information."""
    return {
        "message": "Payment-Gated API",
        "endpoints": {
            "image_generator": "POST /image_generator - 100 USDC",
            "weather": "POST /weather - 0.001 USDC",
        },
    }


@app.post("/image_generator")
async def generate_images(request: ContentRequest) -> dict[str, Any]:
    """Generate images based on the provided query.

    Requires payment of 100 USDC.

    Args:
        request: ContentRequest with query field

    Returns:
        Dictionary containing the generated image paths

    """
    try:
        result = create_images_with_agent(request.query)
        return {
            "success": True,
            "content": result.message,
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
        }


@app.post("/weather")
async def get_weather(request: WeatherRequest) -> dict[str, Any]:
    """Get current weather information for a specified city.

    Requires payment of $0.001.

    Args:
        request: WeatherRequest with city and optional units

    Returns:
        WeatherResponse containing current weather data or error

    """
    print(f"Weather request for city: {request.city}, units: {request.units}")

    try:
        weather_data = get_weather_data(request.city, request.units)

        # Parse the OpenWeather API response
        weather_response = {
            "temperature": weather_data["main"]["temp"],
            "feels_like": weather_data["main"]["feels_like"],
            "temp_min": weather_data["main"]["temp_min"],
            "temp_max": weather_data["main"]["temp_max"],
            "pressure": weather_data["main"]["pressure"],
            "humidity": weather_data["main"]["humidity"],
            "description": weather_data["weather"][0]["description"],
            "wind_speed": weather_data["wind"]["speed"],
            "clouds": weather_data["clouds"]["all"],
            "city": weather_data["name"],
            "country": weather_data["sys"]["country"],
        }

        print(f"Weather data retrieved successfully for {request.city}")
        return weather_response

    except Exception as e:
        return {
            "error": str(e),
        }


if __name__ == "__main__":
    uvicorn.run(app, host=HOST, port=PORT, log_level="info")
