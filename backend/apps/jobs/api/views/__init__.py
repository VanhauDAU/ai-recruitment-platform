"""Public HTTP views grouped by jobs use case."""

from .catalogs import BenefitListView, JobCategoryListView, LanguageListView
from .employer import EmployerJobDetailView, EmployerJobListCreateView
from .public import (
    JobDetailView,
    JobListView,
    JobStatsView,
    JobSuggestView,
    SavedJobDestroyView,
    SavedJobListCreateView,
)

__all__ = [
    'BenefitListView',
    'EmployerJobDetailView',
    'EmployerJobListCreateView',
    'JobCategoryListView',
    'JobDetailView',
    'JobListView',
    'JobStatsView',
    'JobSuggestView',
    'LanguageListView',
    'SavedJobDestroyView',
    'SavedJobListCreateView',
]
