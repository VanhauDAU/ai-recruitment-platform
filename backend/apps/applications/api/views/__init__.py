from .legacy import (
    CandidateApplicationListCreateView,
    EmployerApplicationListView,
    EmployerApplicationStatusUpdateView,
)
from .v2 import CandidateApplicationV2ListCreateView, RecruiterApplicationSnapshotView

__all__ = [
    'CandidateApplicationListCreateView',
    'CandidateApplicationV2ListCreateView',
    'EmployerApplicationListView',
    'EmployerApplicationStatusUpdateView',
    'RecruiterApplicationSnapshotView',
]
