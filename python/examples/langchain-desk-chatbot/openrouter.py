from typing import Optional
from langchain_openai import ChatOpenAI
from pydantic import SecretStr
from langchain_core.utils.utils import secret_from_env

class ChatOpenRouter(ChatOpenAI):
    openai_api_base: str
    openai_api_key: SecretStr
    model: str

    def __init__(self,
                 model: str,
                 openai_api_key: Optional[SecretStr] = None,
                 openai_api_base: str = "https://openrouter.ai/api/v1",
                 **kwargs):
        
        openai_api_key: SecretStr = secret_from_env("OPENAI_API_KEY", default=None)() if openai_api_key is None else openai_api_key

        super().__init__(openai_api_base=openai_api_base,
                         openai_api_key=openai_api_key,
                         model=model, **kwargs)
