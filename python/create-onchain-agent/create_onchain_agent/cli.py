#!/usr/bin/env python3

import click
import shutil
import os
from rich.console import Console
from copier import run_copy

console = Console()
TEMPLATE_PATH = os.path.join(os.path.dirname(__file__), "../templates/chatbot")

@click.command()
@click.argument("project_name")
def create_project(project_name):
    """Creates a new onchain agent project."""
    
    project_path = os.path.join(os.getcwd(), project_name)

    if os.path.exists(project_path):
        console.print(f"[red]Error: Directory '{project_name}' already exists.[/red]")
        return

    console.print(f"[blue]Creating your onchain agent project: {project_name}[/blue]")
    
    # Use Copier to copy the template
    run_copy(TEMPLATE_PATH, project_path)

    console.print(f"[green]Project created successfully at {project_path}[/green]")
    console.print(f"Next steps:\n  cd {project_name}\n  poetry install\n  mv .env.local .env\n  poetry run python chatbot.py")

if __name__ == "__main__":
    create_project()
