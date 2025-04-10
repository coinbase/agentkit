import re


def read_version(file_path: str, version_key: str) -> str:
    """
    Read a file into memory and pull out the existing version number.
    """
    with open(file_path, "r") as file:
        content = file.read()

    for line in content.split("\n"):
        match = re.match(rf'^{version_key}\s*=\s*(.+?)(?:\{{|$)', line)
        if match:
            return match.group(1).strip().replace('"', '').replace("'", "").replace('\n', '')
    
    raise ValueError(f"Could not find version key {version_key} in {file_path}")


def write_version(file_path: str, version: str, version_key: str):
    """
    Write the bumped version number to the file.
    """
    with open(file_path, "r") as file:
        contents = file.read()
    
    pattern = rf'({version_key}\s*=\s*["\'])[~^>=]*[0-9]+\.[0-9]+\.[0-9]+(["\'])' 
    updated_content = re.sub(pattern, rf'\g<1>{str(version)}\g<2>', contents)
    
    with open(file_path, "w") as file:
        file.write(updated_content) 