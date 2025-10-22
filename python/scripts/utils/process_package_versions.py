from typing import Dict, List
from .detect_new_version_type import detect_new_version_type
from .version import read_version, write_version
from .determine_new_version import determine_new_version


def process_package_versions(packages: List[Dict]) -> Dict[str, str]:
    """
    Process version bumps for a list of packages.
    Returns a dictionary of package names and their new versions.
    """
    results = {}

    for package_config in packages:
        package_name = package_config["name"]
        print(f"\nProcessing version bumps for {package_name}")

        version_type = detect_new_version_type(package_name)

        # no changes, skip
        if version_type is None:
            print(f"{package_name} didn't change; skipping")
            continue

        # Get current version from first file (assuming all files have same version)
        first_file = package_config["files"][0]
        current_version = read_version(first_file["path"], first_file["version_key"])
        new_version = determine_new_version(version_type, current_version)
        
        # Update all files
        for file in package_config["files"]:
            write_version(file["path"], new_version, file["version_key"])
            print(f"Bumped version in {file['path']} from {current_version} to {new_version}")
        
        results[package_name] = new_version

    return results 