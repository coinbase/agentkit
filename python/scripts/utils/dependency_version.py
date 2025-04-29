import re
from .calculate_dependency_range import calculate_dependency_range


def read_dependency_version(file_path: str, dependency_name: str) -> str:
    """
    Read a dependency version from pyproject.toml using uv-style format.
    Returns just the version number (e.g. "0.3.2" from ">=0.3.2,<0.4").
    """
    with open(file_path, "r") as file:
        content = file.read()

    pattern = rf'^\s+"{dependency_name}>=([0-9]+\.[0-9]+\.[0-9]+),.*$'
    
    for line in content.split("\n"):
        match = re.match(pattern, line)
        if match:
            return match.group(1)
    
    raise ValueError(f"Could not find dependency {dependency_name} in {file_path}")


def write_dependency_version(file_path: str, dependency_name: str, version: str):
    """
    Write a dependency version to pyproject.toml using uv-style format.
    Converts version "0.3.2" to format "dependency>=0.3.2,<0.4"
    """
    with open(file_path, "r") as file:
        contents = file.read()
    
    min_version, max_version = calculate_dependency_range(version)
    pattern = rf'"{dependency_name}>=([0-9]+\.[0-9]+\.[0-9]+),<[^"]+"'
    replacement = f'"{dependency_name}{min_version},{max_version}"'
    
    updated_content = re.sub(pattern, replacement, contents, flags=re.MULTILINE)
    
    with open(file_path, "w") as file:
        file.write(updated_content)


def read_dependency_version_legacy(file_path: str, dependency_name: str) -> str:
    """
    Read a dependency version from pyproject.toml using poetry-style format.
    Returns just the version number (e.g. "0.3.2" from "^0.3.2" or "~0.3.2").
    Handles both regular pyproject.toml and Jinja template files.
    """
    with open(file_path, "r") as file:
        content = file.read()

    # Match poetry style dependencies like:
    # coinbase-agentkit = "^0.3.2"
    # coinbase-agentkit = { version = "^0.3.2" }
    # Also handles Jinja conditionals by looking at each line independently
    patterns = [
        rf'{re.escape(dependency_name)}\s*=\s*["\'][\^~]?([0-9]+\.[0-9]+\.[0-9]+)["\']',  # Simple version
        rf'{re.escape(dependency_name)}\s*=\s*{{.*?version\s*=\s*["\'][\^~]?([0-9]+\.[0-9]+\.[0-9]+)["\'].*?}}'  # Table with version
    ]
    
    for line in content.split("\n"):
        # Skip Jinja control flow lines
        if line.strip().startswith("{%") or line.strip().startswith("{{"):
            continue
            
        for pattern in patterns:
            match = re.search(pattern, line)
            if match:
                return match.group(1)
    
    raise ValueError(f"Could not find legacy dependency {dependency_name} in {file_path}")


def write_dependency_version_legacy(file_path: str, dependency_name: str, version: str):
    """
    Write a dependency version to pyproject.toml using poetry-style format.
    Preserves the existing format (^ or ~) and table structure if present.
    Handles both regular pyproject.toml and Jinja template files.
    """
    with open(file_path, "r") as file:
        contents = file.read()
    
    # Try to update both simple and table formats
    # Use re.escape on dependency_name to handle special characters
    patterns = [
        (rf'({re.escape(dependency_name)}\s*=\s*["\'])([\^~]?)([0-9]+\.[0-9]+\.[0-9]+)(["\'])',  # Simple version
         rf'\g<1>\g<2>{version}\g<4>'),
        (rf'({re.escape(dependency_name)}\s*=\s*{{.*?version\s*=\s*["\'])([\^~]?)([0-9]+\.[0-9]+\.[0-9]+)(["\'].*?}})',  # Table with version
         rf'\g<1>\g<2>{version}\g<4>')
    ]
    
    updated = False
    updated_content = contents
    
    # Process the file line by line to handle Jinja templates
    new_lines = []
    for line in updated_content.split("\n"):
        # Skip Jinja control flow lines
        if line.strip().startswith("{%") or line.strip().startswith("{{"):
            new_lines.append(line)
            continue
            
        current_line = line
        for pattern, replacement in patterns:
            new_line = re.sub(pattern, replacement, current_line)
            if new_line != current_line:
                updated = True
                current_line = new_line
                break
        new_lines.append(current_line)
    
    if not updated:
        raise ValueError(f"Could not update legacy dependency {dependency_name} in {file_path}")
    
    with open(file_path, "w") as file:
        file.write("\n".join(new_lines)) 