"""Gợi ý việc làm theo ngữ nghĩa (chiến lược `semantic-v1`, kế hoạch bản 3 mục 5).

Bước 1, tìm: vector toàn văn của CV được so với vector toàn văn của mọi tin đang công
khai mà ứng viên chưa ứng tuyển hay ẩn, bằng khoảng cách cosine của pgvector. Tìm
chính xác (quét hết), không dùng chỉ mục xấp xỉ: với vài nghìn tin, quét hết vẫn
nhanh, đúng 100% và cho cùng kết quả mỗi lần.

Bước 2, xếp lại `SEMANTIC_POOL` tin gần nhất bằng dữ liệu đã có trong hồ sơ:

    điểm = 0,75 · mức liên quan + 0,25 · tỷ lệ kỹ năng của tin mà CV có  (+0,05 nếu đúng tỉnh mong muốn)

Mức liên quan là trung bình của điểm toàn văn và điểm chức danh, quy đổi cosine về
0–100 bằng đúng mốc hiệu chuẩn của "Xem độ phù hợp" (`domain.calibration`). Không
có bước nào cần nạp mô hình: vector của CV và tin đã được tính sẵn khi lưu.

Kết quả chỉ mang lý do bằng lời; điểm dùng để sắp xếp, không hiển thị cho ứng viên.
"""

import numpy as np
from django.utils.translation import gettext as _
from pgvector.django import CosineDistance

from apps.cvs.models import CvVersion, UserCv

from ..domain import EXTRACTOR_VERSION, calibration_for, model_version, to_score
from ..models import MatchChunk, MatchDocument

STRATEGY = 'semantic-v1'
SEMANTIC_POOL = 100
RELEVANCE_WEIGHT, SKILL_WEIGHT = 0.75, 0.25
PREFERRED_PROVINCE_BONUS = 0.05
# Dưới mức này tin không được gợi ý: mức liên quan quá thấp so với cặp khác ngành. Đo
# trên 100 CV tổng hợp (`ml/reports/recommendations.md`): ở 35 điểm khoảng 10% tin neo của
# CV khớp mạnh bị cắt và 5% CV không còn gợi ý nào, nên lấy 30.
MIN_SEMANTIC_SCORE = 30
STRONG_SIGNAL = 0.6
MAX_LISTED_SKILLS = 3


def recommendation_cv(user, public_id=None):
    """CV dùng để gợi ý: CV được chỉ định, hoặc CV mặc định, hoặc CV sửa gần nhất.

    Bỏ CV đã xóa, bị khóa, lưu trữ, và bản mẫu của CV builder mà ứng viên chưa bấm Lưu
    (cùng quy tắc với `cvs.services.is_unsaved_builder_baseline`).
    """
    queryset = (
        UserCv.objects.filter(
            user=user,
            is_deleted=False,
            deleted_at__isnull=True,
            moderation_locked_at__isnull=True,
            latest_version__isnull=False,
        )
        .exclude(lifecycle_status=UserCv.LifecycleStatus.ARCHIVED)
        .exclude(
            cv_type=UserCv.CvType.BUILDER,
            latest_version__version_kind=CvVersion.VersionKind.INITIAL,
        )
        .select_related('latest_version')
    )
    if public_id is not None:
        return queryset.filter(public_id=public_id).first()
    return queryset.order_by('-is_default', '-updated_at', '-pk').first()


def _current(kind):
    return MatchDocument.objects.filter(
        kind=kind,
        is_current=True,
        status=MatchDocument.Status.READY,
        extractor_version=EXTRACTOR_VERSION,
        model_version=model_version(),
        embedding__isnull=False,
    )


def cv_document_for(cv):
    """Hồ sơ và vector hiện hành của phiên bản mới nhất của CV, hoặc None nếu chưa tính xong."""
    return _current(MatchDocument.Kind.CV).filter(cv_version_id=cv.latest_version_id).first()


def _title_vectors(document_ids):
    rows = MatchChunk.objects.filter(document_id__in=document_ids, section='title').values_list(
        'document_id', 'embedding'
    )
    return {document_id: np.asarray(vector, dtype=np.float32) for document_id, vector in rows}


def _counted_skills(profile):
    return {
        skill['skill_id']: skill['name'] for skill in profile.get('skills', []) if skill['counted']
    }


def _reasons(*, shared, title_score, document_score, preferred_place):
    reasons = []
    if shared:
        names = ', '.join(list(shared.values())[:MAX_LISTED_SKILLS])
        reasons.append(_('Trùng kỹ năng: %(names)s') % {'names': names})
    if title_score is not None and title_score >= STRONG_SIGNAL:
        reasons.append(_('Vị trí gần với CV của bạn'))
    if document_score >= STRONG_SIGNAL:
        reasons.append(_('Kinh nghiệm trong CV gần với yêu cầu của tin'))
    if preferred_place:
        reasons.append(_('Đúng nơi làm việc bạn mong muốn'))
    return reasons or [_('Nội dung CV gần với tin này')]


def rank_jobs_for_cv(cv_document, job_queryset, *, province_ids=(), min_score=MIN_SEMANTIC_SCORE):
    """[{job_id, match_score, match_reasons, match_details}] theo thứ tự gợi ý.

    `job_queryset` là các tin được phép gợi ý (bên gọi đã lọc tin công khai, tin đã ứng
    tuyển, tin đã ẩn). Số truy vấn cố định: một truy vấn tìm, một truy vấn lấy vector
    chức danh, không phụ thuộc số tin. `min_score=0` giữ mọi tin (dùng khi đo).
    """
    vector = np.asarray(cv_document.embedding, dtype=np.float32)
    nearest = list(
        _current(MatchDocument.Kind.JOB)
        .filter(job__in=job_queryset.values('pk'))
        .annotate(distance=CosineDistance('embedding', vector))
        .order_by('distance', 'job_id')
        .values('pk', 'job_id', 'distance', 'profile_json')[:SEMANTIC_POOL]
    )
    titles = _title_vectors([cv_document.pk, *(row['pk'] for row in nearest)])
    calibration = calibration_for(cv_document.model_version)
    cv_title = titles.get(cv_document.pk)
    cv_skills = _counted_skills(cv_document.profile_json)
    preferred = set(province_ids)

    ranked = []
    for row in nearest:
        document_score = to_score(1 - row['distance'], calibration.document) / 100
        job_title = titles.get(row['pk'])
        title_score = None
        if cv_title is not None and job_title is not None:
            title_score = to_score(float(cv_title @ job_title), calibration.title) / 100
        relevance = np.mean([score for score in (document_score, title_score) if score is not None])
        job_skills = _counted_skills(row['profile_json'])
        shared = {skill_id: name for skill_id, name in job_skills.items() if skill_id in cv_skills}
        score = relevance if not job_skills else (
            RELEVANCE_WEIGHT * relevance + SKILL_WEIGHT * len(shared) / len(job_skills)
        )  # fmt: skip
        places = {place['province_id'] for place in row['profile_json'].get('locations', [])}
        preferred_place = bool(preferred & places)
        score = min(1.0, score + (PREFERRED_PROVINCE_BONUS if preferred_place else 0))
        match_score = round(float(score) * 100)
        if match_score < min_score:
            continue
        ranked.append(
            {
                'job_id': row['job_id'],
                'match_score': match_score,
                'match_details': [],
                'match_reasons': _reasons(
                    shared=shared,
                    title_score=title_score,
                    document_score=document_score,
                    preferred_place=preferred_place,
                ),
            }
        )
    ranked.sort(key=lambda item: (-item['match_score'], item['job_id']))
    return ranked
