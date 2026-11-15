"""Creating a company and joining an existing one (owner approval)."""

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError

from ..models import Company, CompanyJoinRequest, EmployerNotification, RecruiterProfile
from ..models.readiness import has_explicit_company_link
from .notifications import emit_employer_event
from .profiles import get_or_create_recruiter

ALREADY_LINKED_MESSAGE = 'Bạn đã liên kết với một công ty, không thể tạo hoặc đổi công ty khác.'


def _locked_unlinked_recruiter(user):
    get_or_create_recruiter(user)
    recruiter = RecruiterProfile.objects.select_for_update().get(user=user)
    if has_explicit_company_link(recruiter):
        raise ValidationError({'detail': ALREADY_LINKED_MESSAGE})
    return recruiter


def _link(recruiter, company, role):
    recruiter.company = company
    recruiter.company_role = role
    recruiter.save(update_fields=['company', 'company_role', 'updated_at'])


@transaction.atomic
def create_company_for_recruiter(user, serializer):
    """The recruiter creating a company becomes its owner at once."""
    recruiter = _locked_unlinked_recruiter(user)
    CompanyJoinRequest.objects.filter(
        recruiter=recruiter, status=CompanyJoinRequest.Status.PENDING
    ).update(status=CompanyJoinRequest.Status.CANCELLED, decided_at=timezone.now())
    company = serializer.save(created_by=user)
    _link(recruiter, company, RecruiterProfile.CompanyRole.OWNER)
    return company


def company_owners(company):
    return RecruiterProfile.objects.filter(
        company=company,
        company_role=RecruiterProfile.CompanyRole.OWNER,
        user__is_active=True,
        user__is_deleted=False,
    ).select_related('user')


@transaction.atomic
def request_company_join(user, company_public_id):
    """Ask to join an existing company; nothing is linked until an owner approves."""
    recruiter = _locked_unlinked_recruiter(user)
    company = Company.objects.filter(public_id=company_public_id).first()
    if company is None:
        raise ValidationError({'company': 'Không tìm thấy công ty.'})
    pending = CompanyJoinRequest.objects.filter(
        recruiter=recruiter, status=CompanyJoinRequest.Status.PENDING
    ).first()
    if pending is not None:
        if pending.company_id == company.pk:
            return pending
        raise ValidationError(
            {'detail': 'Bạn đang chờ duyệt ở một công ty khác. Hãy hủy yêu cầu đó trước.'}
        )
    join_request = CompanyJoinRequest.objects.create(recruiter=recruiter, company=company)
    requester = user.full_name or user.email
    for owner in company_owners(company):
        emit_employer_event(
            recipient=owner.user,
            actor=user,
            event_type=EmployerNotification.EventType.COMPANY_JOIN_REQUESTED,
            dedupe_key=f'company-join-requested:{join_request.public_id}',
            message=f'{requester} muốn tham gia {company.company_name}.',
            subject_public_id=join_request.public_id,
            metadata={'company_public_id': company.public_id},
        )
    return join_request


@transaction.atomic
def cancel_company_join(user):
    updated = CompanyJoinRequest.objects.filter(
        recruiter__user=user, status=CompanyJoinRequest.Status.PENDING
    ).update(status=CompanyJoinRequest.Status.CANCELLED, decided_at=timezone.now())
    if not updated:
        raise NotFound('Không có yêu cầu tham gia nào đang chờ.')


def _require_owner(user, company):
    owner = RecruiterProfile.objects.filter(
        user=user, company=company, company_role=RecruiterProfile.CompanyRole.OWNER
    ).exists()
    if not owner and not getattr(user, 'is_admin_role', False):
        raise PermissionDenied('Chỉ chủ công ty mới duyệt được yêu cầu tham gia.')


@transaction.atomic
def decide_company_join(user, public_id, *, approve):
    """An owner of the company (or an administrator) approves or rejects."""
    join_request = (
        CompanyJoinRequest.objects.select_for_update()
        .select_related('company', 'recruiter__user')
        .filter(public_id=public_id)
        .first()
    )
    if join_request is None:
        raise NotFound('Không tìm thấy yêu cầu tham gia.')
    _require_owner(user, join_request.company)
    if join_request.status != CompanyJoinRequest.Status.PENDING:
        raise ValidationError({'detail': 'Yêu cầu này đã được xử lý.'})
    recruiter = RecruiterProfile.objects.select_for_update().get(pk=join_request.recruiter_id)
    if approve and has_explicit_company_link(recruiter):
        approve = False  # linked elsewhere meanwhile; the request cannot apply
    join_request.status = (
        CompanyJoinRequest.Status.APPROVED if approve else CompanyJoinRequest.Status.REJECTED
    )
    join_request.decided_by = user
    join_request.decided_at = timezone.now()
    join_request.save(update_fields=['status', 'decided_by', 'decided_at'])
    company = join_request.company
    if approve:
        _link(recruiter, company, RecruiterProfile.CompanyRole.MEMBER)
    emit_employer_event(
        recipient=recruiter.user,
        actor=user,
        event_type=(
            EmployerNotification.EventType.COMPANY_JOIN_APPROVED
            if approve
            else EmployerNotification.EventType.COMPANY_JOIN_REJECTED
        ),
        dedupe_key=f'company-join-decided:{join_request.public_id}',
        message=(
            f'Bạn đã được thêm vào {company.company_name}.'
            if approve
            else f'Yêu cầu tham gia {company.company_name} không được chấp nhận.'
        ),
        subject_public_id=join_request.public_id,
        metadata={'company_public_id': company.public_id},
    )
    return join_request
