import pytest
from datetime import datetime
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

from artist_manager_agent.agent import (
    ArtistManagerAgent,
    Track,
    Release,
    MasteringJob,
    ReleaseType,
    MasteringPreset,
    DistributionPlatform
)

@pytest.fixture
def mock_track():
    return Track(
        title="Test Track",
        artist="Test Artist",
        genre="Pop",
        release_date=datetime.now(),
        file_path=Path("/test/track.wav"),
        created_at=datetime.now(),
        updated_at=datetime.now()
    )

@pytest.fixture
def mock_release():
    track = mock_track()
    return Release(
        title="Test Album",
        artist="Test Artist",
        type=ReleaseType.ALBUM,
        tracks=[track],
        genre="Pop",
        release_date=datetime.now(),
        artwork_path=Path("/test/artwork.jpg"),
        created_at=datetime.now(),
        updated_at=datetime.now()
    )

@pytest.fixture
def agent():
    return ArtistManagerAgent()

@pytest.mark.asyncio
async def test_create_release(agent, mock_release):
    """Test creating a release."""
    await agent.add_release(mock_release)
    releases = await agent.get_releases()
    assert len(releases) == 1
    assert releases[0].title == "Test Album"
    assert releases[0].artist == "Test Artist"

@pytest.mark.asyncio
async def test_submit_for_mastering(agent, mock_track):
    """Test submitting a track for AI mastering."""
    result = await agent.master_track(
        track=mock_track,
        options={"preset": MasteringPreset.BALANCED}
    )
    assert result["status"] == "processing"

@pytest.mark.asyncio
async def test_get_platform_stats(agent, mock_release):
    """Test getting platform-specific statistics."""
    await agent.add_release(mock_release)
    stats = await agent.get_platform_stats(
        platform=DistributionPlatform.SPOTIFY,
        release_id=mock_release.id
    )
    assert "streams" in stats
    assert "listeners" in stats
    assert "saves" in stats 