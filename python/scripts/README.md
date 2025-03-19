## Getting Started

From the `python` folder, run:

```
./scripts/version.sh
```

This will consume changelogs in each Python package, determine the new version, update the version in all relevant files, and produce updates to all relevant CHANGELOG.md files.

After running the script, you'll need to add and commit the changes:

```
git add .
git commit -m "chore: version packages"
```

## Adding new packages

To add a new package, modify the `bump_configs` variable in `version.py`. The key should be the name of the top-level folder housing the package, and the value should be a dictionary containing the following keys:

- `files`: A list of dictionaries, each containing the following keys:
  - `path`: The path to the file to update.
  - `version_key`: The key to update in the file.
