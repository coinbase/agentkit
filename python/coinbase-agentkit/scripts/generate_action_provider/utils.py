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


def display_banner() -> None:
    """Display the AgentKit banner."""
    console.print(Panel.fit(AGENTKIT_BANNER, border_style="blue"))


def provider_exists(name: str) -> bool:
    """Check if an action provider with the given name already exists.

    Args:
        name: The name to check

    Returns:
        bool: True if provider exists, False otherwise

    """
    provider_dir = Path("coinbase_agentkit/action_providers") / name
    return provider_dir.exists()


def validate_name(name: str) -> bool:
    """Validate the action provider name.

    Args:
        name: The name to validate

    Returns:
        bool: True if valid, False otherwise

    """
    return bool(re.match(r"^[a-z][a-z0-9_]*$", name))


def format_pascal_case(text: str) -> str:
    """Convert a string to PascalCase.

    Args:
        text: String to convert

    Returns:
        str: Converted string in PascalCase

    """
    return "".join(word.capitalize() for word in text.split("_"))


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

    if not rendered.endswith("\n"):
        rendered += "\n"

    with open(output_path, "w", encoding="utf-8") as f:
        f.write(rendered)


def add_provider_files(config: ProviderConfig, provider_dir: Path, test_dir: Path) -> None:
    """Create all necessary files for the action provider.

    Args:
        config: The provider configuration
        provider_dir: Directory path for the provider files
        test_dir: Directory path for the test files

    """
    os.makedirs(provider_dir, exist_ok=True)
    os.makedirs(test_dir, exist_ok=True)

    context = {
        "name": config.name,
        "name_pascal": format_pascal_case(config.name),
        "protocol_family": config.protocol_family,
        "network_ids": config.network_ids,
        "wallet_provider": config.wallet_provider,
    }

    template_dir = Path(__file__).parent / "templates"

    provider_templates = {
        "__init__.py": "__init__.py.template",
        f"{config.name}_action_provider.py": "action_provider.py.template",
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


def update_action_providers_init(config: ProviderConfig) -> None:
    """Update the action providers __init__.py file to include the new provider.

    Args:
        config: The provider configuration

    """
    init_path = Path("coinbase_agentkit/action_providers/__init__.py")

    with open(init_path, encoding="utf-8") as f:
        lines = f.readlines()

    name = config.name
    name_pascal = format_pascal_case(config.name)

    last_import_idx = 0
    closing_bracket_idx = 0

    import_exists = False
    instance_exists = False
    provider_exists = False

    instance_pattern = rf"import.*{name}_action_provider"
    provider_pattern = rf"import.*{name_pascal}ActionProvider"

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
        new_import = f"from .{name}.{name}_action_provider import {name_pascal}ActionProvider, {name}_action_provider\n"
        lines.insert(last_import_idx + 1, new_import)
        closing_bracket_idx += 1

    if not instance_exists:
        lines.insert(closing_bracket_idx, f'    "{name}_action_provider",\n')
    if not provider_exists:
        lines.insert(closing_bracket_idx, f'    "{name_pascal}ActionProvider",\n')

    with open(init_path, "w", encoding="utf-8") as f:
        f.writelines(lines)


def update_agentkit_init(config: ProviderConfig) -> None:
    """Update the root __init__.py file to include the new provider.

    Args:
        config: The provider configuration

    """
    init_path = Path("coinbase_agentkit/__init__.py")

    with open(init_path, encoding="utf-8") as f:
        lines = f.readlines()

    name = config.name
    constructor_fn_name = f"{name}_action_provider"

    import_pattern = r"^\s*from\s+\.action_providers\s+import\s*\(\s*$"
    all_pattern = r"^\s*__all__\s*=\s*\[\s*$"

    in_imports = False
    in_all = False
    import_exists = False
    entry_exists = False

    for i, line in enumerate(lines):
        if re.match(import_pattern, line):
            in_imports = True
        elif re.match(all_pattern, line):
            in_all = True

        if in_imports:
            if constructor_fn_name in line:
                import_exists = True
            if line.strip() == ")":
                if not import_exists:
                    lines.insert(i, f"    {constructor_fn_name},\n")
                in_imports = False

        elif in_all:
            if constructor_fn_name in line:
                entry_exists = True
            if line.strip() == "]":
                if not entry_exists:
                    lines.insert(i, f'    "{constructor_fn_name}",\n')
                in_all = False

    with open(init_path, "w", encoding="utf-8") as f:
        f.writelines(lines)


def display_success_message(provider_name: str) -> None:
    """Display success message with next steps.

    Args:
        provider_name: The name of the created provider

    """
    files = SUCCESS_MESSAGES["FILE_STRUCTURE"](provider_name)
    desc = SUCCESS_MESSAGES["DESCRIPTIONS"]

    print(SUCCESS_MESSAGES["FILES_CREATED"])
    print(files["DIR"])
    for key in ["PROVIDER", "SCHEMAS", "README"]:
        print(f"{files[key]:<{len(files['PROVIDER']) + 2}}{desc[key]}")

    print(f"\ntests/action_providers/{provider_name}/")
    print("    ├── __init__.py")
    print("    ├── conftest.py (test fixtures and mock data)")
    print("    ├── test_action_provider.py (main test suite)")
    print("    └── test_example_action.py (example action tests)")

    print(SUCCESS_MESSAGES["NEXT_STEPS"])
    print("1. Replace the example action schema in schemas.py with your own")
    print(
        f"2. Replace the example action implementation in {provider_name}_action_provider.py with your own"
    )
    print("3. Add unit tests to cover your action implementation")
    print("4. Update the README.md with relevant documentation")
    print(
        "5. Add a changelog entry (see here for instructions: https://github.com/coinbase/agentkit/blob/main/CONTRIBUTING-PYTHON.md#changelog"
    )

    print(SUCCESS_MESSAGES["REMINDERS"])
    print("• Run make test to verify your implementation")
    print("• Run make format to format your code")
    print("• Run make lint to ensure code style")
