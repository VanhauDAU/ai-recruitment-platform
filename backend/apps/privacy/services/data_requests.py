"""Quyền của chủ thể dữ liệu (Nghị định 13/2023): xóa tài khoản và xuất dữ liệu.

Người dùng tự gửi yêu cầu; quản trị viên duyệt trong hàng chờ. Xóa tài khoản
theo chính sách giữ dữ liệu hiện có: CV trong thư viện bị xóa cứng, bản chụp CV
đã nộp kèm đơn ứng tuyển vẫn thuộc hồ sơ tuyển dụng của nhà tuyển dụng, tài
khoản được ẩn danh hóa để giữ khóa ngoại.
"""

from datetime import timedelta

from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.utils import timezone
from django.utils.translation import gettext as _

from apps.accounts.api.permissions import require_admin
from apps.accounts.models import User
from apps.accounts.services import anonymize_account, record_admin_action
from apps.candidates.models import CandidateProfile
from apps.cvs.models import UserCv
from apps.cvs.services import permanently_delete_cv
from apps.employers.models import RecruiterProfile
from apps.messaging.services import erase_user_messages

from ..models import DataSubjectRequest

EXPORT_DOWNLOAD_DAYS = 7
NOTE_MAX_LENGTH = 1000


def _clean_note(note, *, required=False):
    note = (note or '').strip()
    if required and not note:
        raise ValidationError({'note': _('Vui lòng nhập ghi chú.')})
    if len(note) > NOTE_MAX_LENGTH:
        raise ValidationError({'note': _('Ghi chú tối đa 1000 ký tự.')})
    return note


def _ensure_owner_can_leave(user):
    profile = RecruiterProfile.objects.filter(user=user).first()
    if not profile or profile.company_role != RecruiterProfile.CompanyRole.OWNER:
        return
    if (
        RecruiterProfile.objects.filter(company_id=profile.company_id)
        .exclude(pk=profile.pk)
        .exists()
    ):
        raise ValidationError(
            _(
                'Bạn đang quản lý công ty có thành viên khác. Hãy chuyển quyền quản lý '
                'công ty trước khi yêu cầu xóa tài khoản.'
            )
        )


def submit_data_request(user, *, kind, note=''):
    if user.role not in {User.Role.CANDIDATE, User.Role.EMPLOYER}:
        raise ValidationError(_('Chỉ tài khoản ứng viên hoặc nhà tuyển dụng gửi được yêu cầu này.'))
    note = _clean_note(note)
    if kind == DataSubjectRequest.Kind.ERASURE and user.is_employer:
        _ensure_owner_can_leave(user)
    try:
        with transaction.atomic():
            return DataSubjectRequest.objects.create(user=user, kind=kind, note=note)
    except IntegrityError as exc:
        raise ValidationError(_('Bạn đã có một yêu cầu cùng loại đang chờ xử lý.')) from exc


def _locked_pending(data_request):
    locked = DataSubjectRequest.objects.select_for_update().get(pk=data_request.pk)
    if locked.status != DataSubjectRequest.Status.PENDING:
        raise ValidationError(_('Yêu cầu này đã được xử lý.'))
    return locked


@transaction.atomic
def cancel_data_request(data_request, *, user):
    locked = _locked_pending(data_request)
    if locked.user_id != user.pk:
        raise ValidationError(_('Không tìm thấy yêu cầu.'))
    locked.status = DataSubjectRequest.Status.CANCELLED
    locked.save(update_fields=['status', 'updated_at'])
    return locked


def _erase_personal_data(user):
    if user.is_employer:
        _ensure_owner_can_leave(user)
        RecruiterProfile.objects.filter(user=user).update(
            contact_phone=None, verified_phone=None, position_title='', gender=''
        )
    else:
        for cv in UserCv.objects.filter(user=user):
            permanently_delete_cv(cv=cv, actor=user)
        CandidateProfile.objects.filter(user=user).delete()
    erase_user_messages(user)
    anonymize_account(user)
    DataSubjectRequest.objects.filter(user=user, status=DataSubjectRequest.Status.PENDING).exclude(
        kind=DataSubjectRequest.Kind.ERASURE
    ).update(status=DataSubjectRequest.Status.CANCELLED, updated_at=timezone.now())


def _close(locked, *, status, actor, note):
    locked.status = status
    locked.resolution_note = note
    locked.handled_by = actor
    locked.handled_at = timezone.now()
    locked.save(
        update_fields=['status', 'resolution_note', 'handled_by', 'handled_at', 'updated_at']
    )
    record_admin_action(
        actor=actor,
        action=f'privacy_request_{status}',
        target_type='data_subject_request',
        target_public_id=locked.public_id,
        payload={'kind': locked.kind, 'account': locked.user.public_id},
    )
    return locked


@transaction.atomic
def complete_data_request(data_request, *, actor, note=''):
    require_admin(actor)
    note = _clean_note(note)
    locked = _locked_pending(data_request)
    if locked.kind == DataSubjectRequest.Kind.ERASURE:
        _erase_personal_data(locked.user)
    return _close(locked, status=DataSubjectRequest.Status.COMPLETED, actor=actor, note=note)


@transaction.atomic
def reject_data_request(data_request, *, actor, note):
    require_admin(actor)
    note = _clean_note(note, required=True)
    locked = _locked_pending(data_request)
    return _close(locked, status=DataSubjectRequest.Status.REJECTED, actor=actor, note=note)


def export_available_until(data_request):
    if (
        data_request.kind != DataSubjectRequest.Kind.EXPORT
        or data_request.status != DataSubjectRequest.Status.COMPLETED
        or not data_request.handled_at
    ):
        return None
    return data_request.handled_at + timedelta(days=EXPORT_DOWNLOAD_DAYS)


def ensure_export_downloadable(data_request, *, user):
    until = export_available_until(data_request)
    if data_request.user_id != user.pk or until is None or until < timezone.now():
        raise ValidationError(_('Bản xuất dữ liệu không còn khả dụng.'))
