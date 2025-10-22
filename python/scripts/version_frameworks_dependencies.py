from utils.process_package_dependency_versions import process_package_dependency_versions
from utils.version import read_version
from utils.package_definitions import CORE_PACKAGE, FRAMEWORK_PACKAGES, get_dependency_files
import sys


def main():
    try:
        core_version = read_version(CORE_PACKAGE["path"], "version")
    except (FileNotFoundError, ValueError) as e:
        print(f"Warning: Could not read core package version: {e}", file=sys.stderr)
        return 1

    # Get dependency files configuration for framework packages
    framework_packages = get_dependency_files(FRAMEWORK_PACKAGES)

    # Redirect dependency update output to stderr
    old_stdout = sys.stdout
    sys.stdout = sys.stderr
    updates = process_package_dependency_versions(
        framework_packages, 
        [{CORE_PACKAGE["package_name"]: core_version}]  # Pass as a list with one dependency set
    )
    sys.stdout = old_stdout

    # Print formatted messages for shell script to process
    if updates:
        for package, dep_name, new_version, _ in updates:
            print(f"{package}: Bump {dep_name} to {new_version}")
        return 0
    
    return 1


if __name__ == "__main__":
    sys.exit(main()) 