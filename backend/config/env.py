"""Load backend configuration from one explicit file plus process environment."""

import os
from pathlib import Path

from decouple import Config, RepositoryEmpty, RepositoryEnv

BACKEND_ROOT = Path(__file__).resolve().parent.parent
BACKEND_ENV_FILE = BACKEND_ROOT / '.env'


def build_config(env_file: Path = BACKEND_ENV_FILE) -> Config:
    """Return a resolver that never walks up to a repository-level ``.env``.

    ``BACKEND_IGNORE_ENV_FILE=1`` reads the process environment only, so a check
    of production settings is not polluted by a developer's local ``.env``.
    """
    if os.environ.get('BACKEND_IGNORE_ENV_FILE') == '1' or not env_file.is_file():
        return Config(RepositoryEmpty())
    return Config(RepositoryEnv(str(env_file)))


config = build_config()
