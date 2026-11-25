"""View HTTP của đối sánh CV–tin."""

from .analyses import (
    AnalysisDetailView,
    AnalysisListCreateView,
)
from .profiles import CvProfileView

__all__ = [
    'CvProfileView',
    'AnalysisDetailView',
    'AnalysisListCreateView',
]
