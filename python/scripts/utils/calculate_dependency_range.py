def calculate_dependency_range(version: str) -> tuple[str, str]:
    """
    Calculate the min and max version range for a dependency.
    For version "0.3.2" returns (">=0.3.2", "<0.4")
    """
    [major, minor, patch] = version.split(".")
    min_version = f">={major}.{minor}.{patch}"
    max_version = f"<{major}.{int(minor) + 1}"
    return (min_version, max_version) 