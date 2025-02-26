"""Utility functions for the action provider generator script."""

import os
import re
from pathlib import Path
from typing import Any

from jinja2 import Environment, FileSystemLoader
from rich import print
from rich.console import Console
from rich.panel import Panel

from .constants import AGENTKIT_BANNER, SUCCESS_MESSAGES
from .types import ProviderConfig

console = Console()

def validate_name(name: str) -> bool:
    """Validate the action provider name.

    Args:
        name: The name to validate

    Returns:
        bool: True if valid, False otherwise

    """
    return bool(re.match(r"^[a-z][a-z0-9_]*$", name))

def create_directory(path: str) -> None:
    """Create a directory if it doesn't exist.

    Args:
        path: Directory path to create

    """
    os.makedirs(path, exist_ok=True)

def process_template(template_path: str, output_path: str, context: dict[str, Any]) -> None:
    """Process a Jinja2 template and write the result to a file.

    Args:
        template_path: Path to the template file
        output_path: Path where the processed file should be written
        context: Template context variables

    """
    template_dir = os.path.dirname(template_path)
    template_name = os.path.basename(template_path)

    env = Environment(
        loader=FileSystemLoader(template_dir),
        trim_blocks=True,
        lstrip_blocks=True,
        keep_trailing_newline=True,
    )

    template = env.get_template(template_name)
    rendered = template.render(**context)

    if not rendered.endswith('\n'):
        rendered += '\n'

    with open(output_path, "w", encoding="utf-8") as f:
        f.write(rendered)

def display_banner() -> None:
    """Display the AgentKit banner."""
    console.print(Panel.fit(AGENTKIT_BANNER, border_style="blue"))

def get_provider_path(config: ProviderConfig) -> Path:
    """Get the path where the action provider should be created.

    Args:
        config: Provider configuration

    Returns:
        Path: Directory path for the action provider

    """
    return Path("coinbase_agentkit/action_providers") / config["name"]

def format_snake_case(text: str) -> str:
    """Convert a string to snake_case.

    Args:
        text: String to convert

    Returns:
        str: Converted string in snake_case

    """
    s1 = re.sub("(.)([A-Z][a-z]+)", r"\1_\2", text)
    return re.sub("([a-z0-9])([A-Z])", r"\1_\2", s1).lower()

def format_pascal_case(text: str) -> str:
    """Convert a string to PascalCase.

    Args:
        text: String to convert

    Returns:
        str: Converted string in PascalCase

    """
    return "".join(word.capitalize() for word in text.split("_"))

def get_template_context(config: ProviderConfig) -> dict[str, Any]:
    """Get the template context for file generation.

    Args:
        config: The provider configuration

    Returns:
        dict[str, Any]: Template context variables

    """
    return {
        "name": config["name"],
        "name_pascal": format_pascal_case(config["name"]),
        "protocol_family": config["protocol_family"],
        "network_ids": config["network_ids"],
        "wallet_provider": config["wallet_provider"],
    }

def update_action_providers_init(config: ProviderConfig) -> None:
    """Update the action providers __init__.py file to include the new provider.

    Args:
        config: The provider configuration

    """
    init_path = Path("coinbase_agentkit/action_providers/__init__.py")

    with open(init_path, encoding="utf-8") as f:
        lines = f.readlines()

    name = config["name"]
    name_pascal = format_pascal_case(name)

    last_import_idx = 0
    closing_bracket_idx = 0

    import_exists = False
    instance_exists = False
    provider_exists = False

    instance_pattern = rf'import.*{name}_action_provider'
    provider_pattern = rf'import.*{name_pascal}ActionProvider'

    for i, line in enumerate(lines):
        if line.startswith("from ."):
            last_import_idx = i
            if re.search(provider_pattern, line) or re.search(instance_pattern, line):
                import_exists = True
        elif line.strip() == "]":
            closing_bracket_idx = i
            break
        elif f'"{name_pascal}ActionProvider"' in line:
            provider_exists = True
        elif f'"{name}_action_provider"' in line:
            instance_exists = True

    if not import_exists:
        new_import = f'from .{name}.{name}_action_provider import {name_pascal}ActionProvider, {name}_action_provider\n'
        lines.insert(last_import_idx + 1, new_import)
        closing_bracket_idx += 1

    if not instance_exists:
        lines.insert(closing_bracket_idx, f'    "{name}_action_provider",\n')
    if not provider_exists:
        lines.insert(closing_bracket_idx, f'    "{name_pascal}ActionProvider",\n')

    with open(init_path, "w", encoding="utf-8") as f:
        f.writelines(lines)

def create_provider_files(config: ProviderConfig) -> None:
    """Create all necessary files for the action provider.

    Args:
        config: The provider configuration

    """
    provider_dir = get_provider_path(config)
    create_directory(provider_dir)

    test_dir = Path("tests/action_providers") / config["name"]
    create_directory(test_dir)

    context = get_template_context(config)

    template_dir = Path(__file__).parent / "templates"

    provider_templates = {
        "__init__.py": "__init__.py.template",
        f"{config['name']}_action_provider.py": "action_provider.py.template",
        "schemas.py": "schemas.py.template",
        "README.md": "README.md.template",
    }

    for output_file, template_file in provider_templates.items():
        template_path = template_dir / template_file
        output_path = provider_dir / output_file
        process_template(str(template_path), str(output_path), context)

    (test_dir / "__init__.py").touch()
    template_path = template_dir / "conftest.py.template"
    output_path = test_dir / "conftest.py"
    process_template(str(template_path), str(output_path), context)

    test_templates = {
        "test_action_provider.py": "action_provider_test.py.template",
        "test_example_action.py": "test_example_action.py.template",
    }

    for output_file, template_file in test_templates.items():
        template_path = template_dir / template_file
        output_path = test_dir / output_file
        process_template(str(template_path), str(output_path), context)

    update_action_providers_init(config)

def display_success_message(provider_name: str) -> None:
    """Display success message with next steps.

    Args:
        provider_name: The name of the created provider

    """
    file_structure = SUCCESS_MESSAGES["FILE_STRUCTURE"](provider_name)
    descriptions = SUCCESS_MESSAGES["DESCRIPTIONS"]

    print(SUCCESS_MESSAGES["FILES_CREATED"])
    print(file_structure["DIR"])
    for key in ["PROVIDER", "SCHEMAS", "README"]:
        print(f"{file_structure[key]} {descriptions[key]}")

    print(f"\ntests/action_providers/{provider_name}/")
    print("    ├── __init__.py")
    print("    ├── conftest.py (test fixtures and mock data)")
    print("    └── test_action_provider.py (test suite)")

    print(SUCCESS_MESSAGES["NEXT_STEPS"])
    print("  1. Review and customize the generated files")
    print("  2. Implement your action logic")
    print("  3. Add tests for your actions")
    print("  4. Update the documentation")

    print(SUCCESS_MESSAGES["REMINDERS"])
    print("  - Add proper error handling")
    print("  - Include comprehensive tests")
    print("  - Document your actions thoroughly")
