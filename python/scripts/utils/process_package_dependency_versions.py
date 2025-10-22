from typing import Dict, List, Tuple, Optional
from .dependency_version import (
    read_dependency_version, write_dependency_version,
    read_dependency_version_legacy, write_dependency_version_legacy
)
import sys


def process_package_dependency_versions(packages: List[Dict], dependencies: List[Dict[str, str]]) -> List[Tuple[str, str, str, Optional[str]]]:
    """
    Process dependency version updates for a list of packages.
    Returns list of tuples (package_name, dependency_name, new_version, subtitle) for each update made.
    
    packages: List of package configs with name and files list
    dependencies: List of dictionaries mapping dependency names to their new versions
    """
    updates = []

    for package_config in packages:
        package_name = package_config["name"]
        print(f"\nChecking dependencies for {package_name}")
        
        # Process each pyproject.toml file in the package
        for file_config in package_config["files"]:
            if not file_config["path"].endswith("pyproject.toml.jinja") and not file_config["path"].endswith("pyproject.toml"):
                continue

            try:
                # Check each dependency set
                for dependency_set in dependencies:
                    for dep_name, dep_version in dependency_set.items():
                        try:
                            # First try uv format
                            current_version = read_dependency_version(file_config["path"], dep_name)
                            write_dependency_version(file_config["path"], dep_name, dep_version)
                        except ValueError:
                            try:
                                # If uv format fails, try poetry format
                                current_version = read_dependency_version_legacy(file_config["path"], dep_name)
                                write_dependency_version_legacy(file_config["path"], dep_name, dep_version)
                            except ValueError:
                                # Dependency not found in this file or format not recognized, skip it
                                continue

                        if current_version != dep_version:
                            print(f"Updated {dep_name} from {current_version} to {dep_version} in {file_config['path']}")
                            # Only add to updates once per package/file combo
                            subtitle = file_config.get("subtitle")
                            if not any(u[0] == package_name and u[1] == dep_name and u[3] == subtitle for u in updates):
                                updates.append((package_name, dep_name, dep_version, subtitle))
            except Exception as e:
                print(f"Warning: Error processing {file_config['path']}: {e}", file=sys.stderr)
                continue

    return updates 