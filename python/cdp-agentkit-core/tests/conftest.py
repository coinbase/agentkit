import os

factory_modules = [
    f[:-3] for f in os.listdir("./tests/factories") if f.endswith(".py") and f != "__init__.py"
]

pytest_plugins = [f"tests.factories.{module_name}" for module_name in factory_modules]
