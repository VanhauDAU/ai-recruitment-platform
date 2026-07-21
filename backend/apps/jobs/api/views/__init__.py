"""Public HTTP views grouped by jobs use case."""

from .catalogs import BenefitListView, JobCategoryListView, LanguageListView
from .employer import EmployerJobDetailView, EmployerJobListCreateView
from .public import (
    CvJobRecommendationView,
    JobDetailView,
    JobListView,
    JobStatsView,
    JobSuggestView,
    JobViewCreateView,
    SavedJobDestroyView,
    SavedJobListCreateView,
)

__all__ = [
    'BenefitListView',
    'CvJobRecommendationView',
    'EmployerJobDetailView',
    'EmployerJobListCreateView',
    'JobCategoryListView',
    'JobDetailView',
    'JobViewCreateView',
    'JobListView',
    'JobStatsView',
    'JobSuggestView',
    'LanguageListView',
    'SavedJobDestroyView',
    'SavedJobListCreateView',
]
