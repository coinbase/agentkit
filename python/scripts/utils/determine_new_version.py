def determine_new_version(version_type: str, version: str) -> str:
    """
    Return the bumped version number based on the version type and existing version.
    """
    [major, minor, patch] = version.split(".")

    if version_type == "minor":
        return f"{major}.{int(minor) + 1}.0"
    elif version_type == "patch":
        return f"{major}.{minor}.{int(patch) + 1}"
    else:
        raise ValueError(f"Unknown version type: {version_type}") 