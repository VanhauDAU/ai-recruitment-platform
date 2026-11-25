"""Search helpers that do not belong to a specific business domain."""

import unicodedata

from django.db.models import Q


def search_q(field, text):
    """Build an accent-insensitive query requiring every search token."""
    query = Q()
    for token in text.split():
        query &= Q(**{f'{field}__unaccent__icontains': token})
    return query


def folded_search_q(field, text):
    """Indexed twin of ``search_q`` for a column that stores ``fold_accents(value)``.

    ``unaccent(col) ILIKE`` cannot use an index; a folded column with a GIN
    trigram index answers the same ``LIKE '%token%'`` from the index.
    """
    query = Q()
    for token in fold_accents(text).split():
        query &= Q(**{f'{field}__contains': token})
    return query


def fold_accents(text):
    """Normalize Vietnamese text for in-memory ranking."""
    text = text.replace('đ', 'd').replace('Đ', 'D')
    return ''.join(
        char for char in unicodedata.normalize('NFD', text) if not unicodedata.combining(char)
    ).lower()
