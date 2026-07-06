import uuid


def generate_public_id(prefix: str) -> str:
    """Short opaque public identifier for URLs/APIs, e.g. usr_8f7a9c2e.

    Internal numeric `id` stays DB-only; public_id is what's exposed so
    sequential integers aren't guessable/enumerable from the outside.
    """
    return f'{prefix}_{uuid.uuid4().hex[:12]}'
