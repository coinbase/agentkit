# Python Package Versioning

This directory contains scripts for managing versions across all Python packages in the monorepo.

## Versioning Process

The versioning process is split into three phases:
### Phase 1: Core Package Versioning
- Updates the core `coinbase-agentkit` package version
- Consumes changelogs and determines new version
- Updates version in all relevant files (pyproject.toml, docs, __version__.py)
- Builds and updates CHANGELOG.md

### Phase 2: Framework and Utility Package Versioning
1. Framework Extensions:
   - Checks for dependency updates against core package
   - Creates changelog entries for dependency updates
   - Processes any framework-specific changelogs
   - Updates versions and builds CHANGELOG.md files

2. Utility Packages:
   - Checks for dependency updates against core and framework packages
   - Creates changelog entries for dependency updates
   - Processes any utility-specific changelogs
   - Updates versions and builds CHANGELOG.md files

### Phase 3: Release Tagging
- Reads current versions of all updated packages
- Creates git tags in the format `package-name@vx.y.z`
- Can be run in dry-run mode (default) or production mode with `--prod` flag

## Running the Process

From the `python` directory:

1. Run Phase 1:
```bash
# Dry run - only processes versions
./scripts/version_phase_1.sh

# Production run - creates branch, commits changes, opens PR
./scripts/version_phase_1.sh --prod
```

After running phase 1 with --prod:
* Review the draft PR titled "chore: version python core package"
* Get PR reviewed and merge to main
* Release the package to pypi

2. Run Phase 2:
```bash
# Dry run - only processes versions
./scripts/version_phase_2.sh

# Production run - creates branch, commits changes, opens PR
./scripts/version_phase_2.sh --prod
```

After running phase 2 with --prod:
* Review the draft PR titled "chore: version python packages"
* Get PR reviewed and merge to main
* Release the packages to pypi

3. Run Phase 3:
```bash
# Dry run (shows what would be done)
./scripts/version_phase_3.sh

# Production run (actually creates and pushes tags)
./scripts/version_phase_3.sh --prod
```

## Testing

The `test` directory contains scripts for testing each phase:

### test_phase_1.sh
Tests core package versioning by:
- Creating a test changelog entry
- Running phase 1
- Verifying version updates and changelog generation

### test_phase_2.sh
Tests framework and utility package versioning by:
- Creating test changelog entries in framework packages
- Creating test changelog entries in utility packages
- Running phase 2
- Verifying dependency updates and changelog generation

Note: Phase 2 testing requires careful setup of dependency versions, as it depends on the results of Phase 1.

### test_phase_3.sh
Tests release tagging by:
- Running phase 3 in dry-run mode
- Verifying tag format and version detection

## Package Configuration

Package definitions are centralized in `utils/package_definitions.py`. Each package configuration includes:

- `name`: The package identifier
- `package_name`: The name used in dependencies
- `path`: Path to the package's pyproject.toml
- `files`: List of files to update versions in
  - `path`: File path
  - `version_key`: Key to update in the file
- `templates`: (Optional) List of template files for dependency updates
  - `subtitle`: Description of the template
  - `path`: Template file path
  - `version_key`: Key to update in the file
