"""Tìm CV cho nhà tuyển dụng: danh sách ẩn danh, xem nhanh có ghi nhật ký, mời ứng tuyển.

Ứng viên xuất hiện dưới một **mã ẩn danh** (`candidate_ref`): HMAC của (công ty, ứng
viên) bằng khóa bí mật của máy chủ. Mã ổn định với một công ty (mở lại vẫn là người
đó), khác nhau giữa các công ty, và không suy ngược ra tài khoản. Máy chủ tìm lại
ứng viên bằng cách tính mã cho các CV đang được phép tìm thấy, nên một mã chỉ còn
dùng được chừng nào ứng viên còn cho phép.

Nhà tuyển dụng không nhận tên, liên hệ, tệp CV, tên công ty cũ hay câu trích nào: chỉ
hồ sơ trích xuất ẩn danh và mức phù hợp (`apps.matching.services.rank_cvs_for_job`).
Bước tiếp theo duy nhất là mời ứng tuyển; khi ứng viên ứng tuyển, hồ sơ đi vào luồng
CV ứng tuyển như mọi hồ sơ khác.

Một ứng viên chỉ được tìm thấy khi **mọi** điều kiện sau đúng tại thời điểm truy vấn
(không lưu đệm, nên rút đồng ý hay tắt CV có hiệu lực ngay ở lần tìm sau):

- đang bật đúng một CV "cho phép NTD tìm kiếm" (`UserCv.recruiter_searchable`), CV
  chưa xóa, không bị khóa kiểm duyệt, không lưu trữ;
- còn đồng ý `RECRUITER_VISIBILITY` ở mức hồ sơ;
- tài khoản đang hoạt động;
- không bị công ty của tin chặn (`CandidateBlock`), và không phải chính người tìm.
"""

import hashlib
import hmac
from http import HTTPStatus

from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction
from django.db.models import Exists, OuterRef
from django.utils.translation import gettext as _
from rest_framework.exceptions import NotFound

from apps.candidates.models import CandidateConsent, CandidateNotification
from apps.candidates.services import emit_candidate_notification
from apps.cvs.models import CvAccessLog, UserCv
from apps.cvs.services import record_cv_access
from apps.matching.services import ProfileFilters, candidate_search_enabled, rank_cvs_for_job
from common.errors import DomainError

from ..models import Application, CandidateBlock, CandidateSearchInvitation, TalentPoolInvitation

REF_LENGTH = 24
CODE_LENGTH = 6
User = get_user_model()


def searchable_cvs(recruiter, job, *, province_id=None):
    """CV đang bật tìm kiếm mà `recruiter` được thấy khi tìm cho `job`.

    `province_id`: chỉ ứng viên có tỉnh/thành này trong nơi làm việc mong muốn (CV không
    mang địa điểm).
    """
    consented = CandidateConsent.objects.filter(
        candidate_profile__user_id=OuterRef('user_id'),
        consent_type=CandidateConsent.ConsentType.RECRUITER_VISIBILITY,
        decision=CandidateConsent.Decision.GRANTED,
    )
    blocked = CandidateBlock.objects.filter(
        CandidateBlock.active_q(), company_id=job.company_id, candidate_id=OuterRef('user_id')
    )
    cvs = (
        UserCv.objects.filter(
            recruiter_searchable=True,
            is_deleted=False,
            deleted_at__isnull=True,
            moderation_locked_at__isnull=True,
            latest_version__isnull=False,
            user__is_active=True,
            user__is_deleted=False,
            user__status=User.Status.ACTIVE,
        )
        .exclude(lifecycle_status=UserCv.LifecycleStatus.ARCHIVED)
        .exclude(user=recruiter)
        .filter(Exists(consented))
        .exclude(Exists(blocked))
    )
    if province_id is not None:
        cvs = cvs.filter(
            user__candidate_profile__job_preference__preferred_provinces__location_id=province_id
        )
    return cvs


def candidate_job_flags(job, candidate_ids):
    """`(đã ứng tuyển, đã mời)`: hai tập id ứng viên trong `candidate_ids` với `job`."""
    applied = set(
        Application.objects.filter(
            job=job, candidate_id__in=candidate_ids, is_current=True
        ).values_list('candidate_id', flat=True)
    )
    invited = set(
        CandidateSearchInvitation.objects.filter(
            job=job, candidate_id__in=candidate_ids
        ).values_list('candidate_id', flat=True)
    ) | set(
        TalentPoolInvitation.objects.filter(
            job=job, entry__candidate_id__in=candidate_ids
        ).values_list('entry__candidate_id', flat=True)
    )
    return applied, invited


class CandidateSearchUnavailable(DomainError):
    """Tìm CV đang tắt (`feature_disabled`) hoặc tin chưa có vector (`job_not_ready`)."""

    status_code = HTTPStatus.CONFLICT

    def __init__(self, code, message):
        self.code = code
        super().__init__(message)


class InvitationConflict(DomainError):
    status_code = HTTPStatus.CONFLICT
    code = 'invitation_conflict'


def ensure_candidate_search_enabled():
    if not candidate_search_enabled():
        raise CandidateSearchUnavailable('feature_disabled', _('Tính năng Tìm CV đang tắt.'))


def candidate_ref(company_id, candidate_id):
    digest = hmac.new(
        settings.SECRET_KEY.encode(),
        f'candidate-search:{company_id}:{candidate_id}'.encode(),
        hashlib.sha256,
    ).hexdigest()
    return digest[:REF_LENGTH]


def _row(job, cv, ranked, *, applied, invited, detail=False):
    ref = candidate_ref(job.company_id, cv.user_id)
    profile = ranked['profile']
    row = {
        'ref': ref,
        'code': f'UV-{ref[:CODE_LENGTH].upper()}',
        'score': ranked['score'],
        'level': ranked['level'],
        'title': profile['title'],
        'experience_months': profile['experience']['months'],
        'education_level': profile['education_level'],
        'position_level': profile['position_level'],
        'languages': profile['languages'],
        'matched_skills': ranked['matched_skills'],
        'matched_skill_count': ranked['matched_skill_count'],
        'job_skill_count': ranked['job_skill_count'],
        'cv_updated_at': cv.updated_at,
        'applied': cv.user_id in applied,
        'invited': cv.user_id in invited,
    }
    if detail:
        row['profile'] = profile
        row['result'] = ranked['result']
    return row


def _ranked(job, cvs, filters, *, min_score=None):
    options = {} if min_score is None else {'min_score': min_score}
    ranked = rank_cvs_for_job(
        job, cvs.values('latest_version_id'), filters=filters or ProfileFilters(), **options
    )
    if ranked is None:
        raise CandidateSearchUnavailable(
            'job_not_ready',
            _('Tin này chưa được phân tích xong. Thử lại sau ít phút hoặc chọn tin khác.'),
        )
    return ranked


def search_candidates(recruiter, job, *, filters=None, province_id=None):
    """Ứng viên phù hợp với `job`, điểm cao trước, đã ẩn danh. `job` là tin của `recruiter`."""
    ensure_candidate_search_enabled()
    cvs = searchable_cvs(recruiter, job, province_id=province_id)
    ranked = _ranked(job, cvs, filters)
    by_version = {
        cv.latest_version_id: cv
        for cv in cvs.filter(latest_version_id__in=[item['cv_version_id'] for item in ranked])
    }
    applied, invited = candidate_job_flags(job, [cv.user_id for cv in by_version.values()])
    return [
        _row(job, by_version[item['cv_version_id']], item, applied=applied, invited=invited)
        for item in ranked
        if item['cv_version_id'] in by_version
    ]


def _searchable_cv(recruiter, job, ref):
    """CV ứng với một mã ẩn danh, chỉ khi ứng viên còn được phép tìm thấy."""
    for cv in searchable_cvs(recruiter, job).select_related('latest_version'):
        if hmac.compare_digest(candidate_ref(job.company_id, cv.user_id), ref):
            return cv
    raise NotFound


def candidate_detail(recruiter, job, ref, *, request):
    """Hồ sơ ẩn danh và mức phù hợp chi tiết của một ứng viên; ghi nhật ký truy cập."""
    ensure_candidate_search_enabled()
    cv = _searchable_cv(recruiter, job, ref)
    ranked = _ranked(job, searchable_cvs(recruiter, job).filter(pk=cv.pk), None, min_score=0)
    if not ranked:
        raise NotFound
    # Gắn với CV trong thư viện (không phải bản chụp hồ sơ ứng tuyển): ứng viên xóa CV thì
    # nhật ký này bị xóa cùng, như mọi dữ liệu thuộc CV đó.
    record_cv_access(
        cv=cv,
        version=cv.latest_version,
        actor_type=CvAccessLog.ActorType.RECRUITER,
        access_channel=CvAccessLog.AccessChannel.RECRUITER_SEARCH,
        request=request,
        actor_user=recruiter,
    )
    applied, invited = candidate_job_flags(job, [cv.user_id])
    return _row(job, cv, ranked[0], applied=applied, invited=invited, detail=True)


@transaction.atomic
def invite_candidate(recruiter, job, ref):
    """Mời một ứng viên tìm thấy ở Tìm CV ứng tuyển vào `job`, tối đa một lần cho mỗi tin."""
    ensure_candidate_search_enabled()
    cv = _searchable_cv(recruiter, job, ref)
    applied, invited = candidate_job_flags(job, [cv.user_id])
    if cv.user_id in applied:
        raise InvitationConflict(_('Ứng viên này đã ứng tuyển tin này.'))
    if cv.user_id in invited:
        raise InvitationConflict(_('Bạn đã mời ứng viên này ứng tuyển tin này.'))
    try:
        with transaction.atomic():
            CandidateSearchInvitation.objects.create(
                recruiter=recruiter, candidate_id=cv.user_id, job=job
            )
    except IntegrityError as error:
        raise InvitationConflict(_('Bạn đã mời ứng viên này ứng tuyển tin này.')) from error
    emit_candidate_notification(
        recipient=cv.user,
        event_type=CandidateNotification.EventType.JOB_INVITATION,
        dedupe_key=f'job-invitation:search:{cv.user_id}:{job.public_id}',
        context={'company_name': job.company.company_name, 'job_title': job.title},
        metadata={'job_public_id': job.public_id},
        action_path=f'/viec-lam/{job.slug}',
    )
