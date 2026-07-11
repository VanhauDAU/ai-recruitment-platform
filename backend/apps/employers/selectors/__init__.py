"""Public read/query API for the employers domain."""

from .companies import search_companies

__all__ = ['search_companies']
