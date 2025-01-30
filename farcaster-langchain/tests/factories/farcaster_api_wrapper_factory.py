import pytest
from typing import Optional

from farcaster_langchain import FarcasterApiWrapper

class FarcasterApiWrapperFactory:
    @staticmethod
    def build(
        neynar_api_key: Optional[str] = "test_api_key",
        signer_uuid: Optional[str] = "test_signer_uuid",
        fid: Optional[str] = "test_fid",
    ) -> FarcasterApiWrapper:
        return FarcasterApiWrapper(
            neynar_api_key=neynar_api_key,
            signer_uuid=signer_uuid,
            fid=fid
        )

@pytest.fixture
def farcaster_api_wrapper() -> FarcasterApiWrapper:
    return FarcasterApiWrapperFactory.build() 