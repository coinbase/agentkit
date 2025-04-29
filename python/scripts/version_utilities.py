from utils.process_package_versions import process_package_versions
from utils.package_definitions import UTILITY_PACKAGES, get_version_files
import sys


def main():
    # Get version files configuration for utility packages
    utility_packages = get_version_files(UTILITY_PACKAGES)

    # Process version bumps from changelogs
    # Redirect process_package_versions output to stderr
    old_stdout = sys.stdout
    sys.stdout = sys.stderr
    results = process_package_versions(utility_packages)
    sys.stdout = old_stdout

    # Print only package names to stdout for bash to process
    for package in results:
        print(package)

    # Return success if any packages were updated
    return 0 if results else 1


if __name__ == "__main__":
    sys.exit(main()) 