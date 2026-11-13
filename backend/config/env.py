"""Load backend configuration from one explicit file plus process environment."""

from pathlib import Path

from decouple import Config, RepositoryEmpty, RepositoryEnv

BACKEND_ROOT = Path(__file__).resolve().parent.parent
BACKEND_ENV_FILE = BACKEND_ROOT / '.env'


def build_config(env_file: Path = BACKEND_ENV_FILE) -> Config:
    """Return a resolver that never walks up to a repository-level ``.env``."""
    repository = RepositoryEnv(str(env_file)) if env_file.is_file() else RepositoryEmpty()
    return Config(repository)


config = build_config()
