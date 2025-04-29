from utils.process_package_dependency_versions import process_package_dependency_versions
from utils.version import read_version
from utils.package_definitions import (
    CORE_PACKAGE, FRAMEWORK_PACKAGES, UTILITY_PACKAGES,
    get_dependency_check_info, get_dependency_files
)
import sys
from collections import defaultdict


def main():
    # Read all dependency versions
    dependency_versions = []
    for dep in get_dependency_check_info():
        try:
            version = read_version(dep["path"], "version")
            dependency_versions.append({dep["package_name"]: version})
        except (FileNotFoundError, ValueError) as e:
            print(f"Warning: Could not read {dep['path']} version: {e}", file=sys.stderr)
            return 1

    # Get dependency files configuration for utility packages
    utility_packages = get_dependency_files(UTILITY_PACKAGES)

    # Redirect dependency update output to stderr
    old_stdout = sys.stdout
    sys.stdout = sys.stderr
    updates = process_package_dependency_versions(
        utility_packages, 
        dependency_versions  # Pass array of individual dependency version objects
    )
    sys.stdout = old_stdout

    # Print formatted messages for shell script to process
    if updates:
        # Group updates by dependency name and subtitle
        grouped_updates = defaultdict(lambda: defaultdict(list))
        for package, dep_name, new_version, subtitle in updates:
            grouped_updates[dep_name][new_version].append(subtitle)

        # Print updates with combined subtitles
        for dep_name, version_groups in grouped_updates.items():
            for version, subtitles in version_groups.items():
                # Filter out None subtitles
                subtitles = [s for s in subtitles if s is not None]
                if subtitles:
                    subtitle_list = ", ".join(subtitles[:-1])
                    if subtitle_list:
                        subtitle_list += " and "
                    subtitle_list += subtitles[-1]
                    print(f"create-onchain-agent: Bump {dep_name} to {version} in {subtitle_list}")
                else:
                    # Handle updates without subtitles
                    print(f"create-onchain-agent: Bump {dep_name} to {version}")
        return 0
    
    return 1


if __name__ == "__main__":
    sys.exit(main()) 