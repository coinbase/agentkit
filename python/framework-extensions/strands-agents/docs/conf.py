# Configuration file for the Sphinx documentation builder.

import os
import sys

# Add the package to the path
sys.path.insert(0, os.path.abspath("../"))

# Project information
project = "Coinbase Agentkit Strands Agents"
author = "Coinbase Developer Platform"
release = "0.1.0"

# Extensions
extensions = [
    "sphinx.ext.autodoc",
    "sphinx.ext.viewcode",
    "sphinx.ext.napoleon",
    "sphinx_autodoc_typehints",
    "myst_parser",
]

templates_path = ['_templates']
exclude_patterns = [
    '_build', 
    'Thumbs.db', 
    '.DS_Store',
    '.ipynb_checkpoints'
]

# Mock imports for dependencies that might not be available during doc build
autodoc_mock_imports = [
    'strands',
    'coinbase_agentkit',
]

# HTML theme
html_theme = "alabaster"
