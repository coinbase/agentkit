import os
from typing import Optional


def detect_new_version_type(package_name: str) -> Optional[str]:
    """
    Detect based on towncrier entries whether package bump should be minor or patch.
    """
    changelog_dir = f"../{package_name}/changelog.d"
    if not os.path.exists(changelog_dir):
        print(f"Changelog directory does not exist: {changelog_dir}")
        return None

    changelog_files = os.listdir(changelog_dir)
    contains_feature = False
    contains_fix = False
    for file in changelog_files:
        if "feature" in file:
            contains_feature = True
        if "bugfix" in file:
            contains_fix = True

    if contains_feature:
        return "minor"
    if contains_fix:
        return "patch"
    return None 