"""Truy vấn dùng chung cho selectors, services và task phân tích.

Đặt ở `models/` vì services xếp task `run_analysis` sau commit, mà services và
selectors không được import lẫn nhau (ADR-0022).
"""

import numpy as np
from django.db.models import Prefetch

from apps.jobs.models import Job, JobSkill

from ..domain import EXTRACTOR_VERSION, model_version
from .analysis import MatchAnalysis
from .documents import MatchChunk, MatchDocument


def jobs_for_profile(statuses=(Job.Status.ACTIVE,)):
    """Tin kèm kỹ năng (và nhóm), yêu cầu ngoại ngữ, địa điểm; không phát sinh N+1.

    `statuses=None` lấy mọi trạng thái (task đang chạy dở khi tin vừa đóng).
    """
    queryset = Job.objects.all() if statuses is None else Job.objects.filter(status__in=statuses)
    return queryset.prefetch_related(
        Prefetch('job_skills', queryset=JobSkill.objects.select_related('skill__group')),
        'language_requirements__language',
        'job_locations__location__parent',
    ).order_by('pk')


def analysis_for_run(analysis_id):
    return MatchAnalysis.objects.select_related('cv_version__cv').filter(pk=analysis_id).first()


def current_documents(kind):
    """Tài liệu hiện hành, đã trích xuất và mã hóa xong, của phiên bản đang chạy."""
    return MatchDocument.objects.filter(
        kind=kind,
        is_current=True,
        status=MatchDocument.Status.READY,
        extractor_version=EXTRACTOR_VERSION,
        model_version=model_version(),
        embedding__isnull=False,
    )


def title_vectors(document_ids):
    """{id tài liệu: vector của chunk chức danh/tiêu đề}; tài liệu không có chức danh thì vắng."""
    rows = MatchChunk.objects.filter(document_id__in=document_ids, section='title').values_list(
        'document_id', 'embedding'
    )
    return {document_id: np.asarray(vector, dtype=np.float32) for document_id, vector in rows}
