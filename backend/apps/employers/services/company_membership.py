"""Creating, joining and handing over a company.

Two steps never mix: an owner *approves a join* (``CompanyJoinRequest``), an
administrator *verifies each recruiter* (``EmployerVerificationCase``). Only an
eligible owner, active and verified, may approve; a company without one falls
back to the administrators.
"""

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError

from ..models import (
    Company,
    CompanyJoinRequest,
    EmployerCompanyLinkEvent,
    EmployerNotification,
    RecruiterProfile,
)
from ..models.readiness import has_explicit_company_link
from ..models.representation import (
    eligible_owners_queryset,
    eligible_representatives_queryset,
)
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
    """Owners who may approve joins and manage members (see ``eligible_owners_queryset``)."""
    return eligible_owners_queryset().filter(company=company).select_related('user')


def company_has_eligible_owner(company):
    return company_owners(company).exists()


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


def _require_decider(user, company):
    """Eligible owners decide; administrators only when the company has none."""
    if getattr(user, 'is_admin_role', False):
        if company_has_eligible_owner(company):
            raise PermissionDenied(
                'Công ty đã có quản lý công ty đã xác thực, yêu cầu này do quản lý công ty duyệt.'
            )
        return
    if company_owners(company).filter(user=user).exists():
        return
    if RecruiterProfile.objects.filter(
        user=user, company=company, company_role=RecruiterProfile.CompanyRole.OWNER
    ).exists():
        raise PermissionDenied(
            'Tài khoản của bạn cần được xác thực trước khi duyệt yêu cầu tham gia.'
        )
    raise PermissionDenied('Chỉ quản lý công ty mới duyệt được yêu cầu tham gia.')


@transaction.atomic
def decide_company_join(user, public_id, *, approve):
    """An eligible owner, or an administrator when there is none, decides."""
    join_request = (
        CompanyJoinRequest.objects.select_for_update()
        .select_related('company', 'recruiter__user')
        .filter(public_id=public_id)
        .first()
    )
    if join_request is None:
        raise NotFound('Không tìm thấy yêu cầu tham gia.')
    _require_decider(user, join_request.company)
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
            f'Bạn đã được duyệt tham gia {company.company_name}. '
            'Bước tiếp theo: nộp giấy tờ để xác thực tài khoản.'
            if approve
            else f'Yêu cầu tham gia {company.company_name} không được chấp nhận.'
        ),
        subject_public_id=join_request.public_id,
        metadata={'company_public_id': company.public_id},
    )
    return join_request


def _eligible_member(company, recruiter_public_id):
    target = (
        eligible_representatives_queryset()
        .select_for_update(of=('self',))
        .filter(company=company, public_id=recruiter_public_id)
        .select_related('user')
        .first()
    )
    if target is None:
        raise ValidationError(
            {'recruiter': 'Chỉ chọn được thành viên của công ty đã được xác thực tài khoản.'}
        )
    return target


def _record_owner_change(*, target, company, actor, event_type, reason, previous_owner_ids):
    EmployerCompanyLinkEvent.objects.create(
        recruiter=target,
        company=company,
        actor=actor,
        event_type=event_type,
        reason=reason,
        impact_snapshot={'previous_owner_recruiter_ids': previous_owner_ids},
    )
    emit_employer_event(
        recipient=target.user,
        actor=actor,
        event_type=EmployerNotification.EventType.COMPANY_OWNERSHIP_CHANGED,
        dedupe_key=(
            f'company-owner:{company.public_id}:{target.public_id}:'
            f'{int(timezone.now().timestamp())}'
        ),
        message=f'Bạn đã trở thành quản lý công ty {company.company_name}.',
        subject_public_id=company.public_id,
    )


@transaction.atomic
def transfer_company_ownership(user, recruiter_public_id):
    """The eligible owner hands the company to a verified member and becomes a member."""
    owner = RecruiterProfile.objects.select_for_update().filter(user=user).first()
    if owner is None or owner.company_id is None:
        raise PermissionDenied('Bạn chưa liên kết với công ty nào.')
    company = owner.company
    if not company_owners(company).filter(pk=owner.pk).exists():
        raise PermissionDenied(
            'Chỉ quản lý công ty đã xác thực tài khoản mới chuyển được quyền quản lý.'
        )
    target = _eligible_member(company, recruiter_public_id)
    if target.pk == owner.pk:
        raise ValidationError({'recruiter': 'Hãy chọn một thành viên khác.'})
    target.company_role = RecruiterProfile.CompanyRole.OWNER
    target.save(update_fields=['company_role', 'updated_at'])
    owner.company_role = RecruiterProfile.CompanyRole.MEMBER
    owner.save(update_fields=['company_role', 'updated_at'])
    _record_owner_change(
        target=target,
        company=company,
        actor=user,
        event_type=EmployerCompanyLinkEvent.EventType.OWNERSHIP_TRANSFERRED,
        reason='Quản lý công ty chuyển quyền quản lý.',
        previous_owner_ids=[owner.pk],
    )
    return target


@transaction.atomic
def admin_assign_company_owner(admin, company, recruiter_public_id, *, reason):
    """Give a company without an eligible owner a new one from its verified members."""
    company = Company.objects.select_for_update().get(pk=company.pk)
    if company_has_eligible_owner(company):
        raise ValidationError(
            {
                'detail': 'Công ty đã có quản lý công ty đã xác thực, người đó tự chuyển quyền nếu cần.'
            }
        )
    reason = (reason or '').strip()
    if not reason:
        raise ValidationError({'reason': 'Nhập lý do chỉ định quản lý công ty.'})
    target = _eligible_member(company, recruiter_public_id)
    previous = list(
        RecruiterProfile.objects.select_for_update()
        .filter(company=company, company_role=RecruiterProfile.CompanyRole.OWNER)
        .exclude(pk=target.pk)
        .values_list('pk', flat=True)
    )
    RecruiterProfile.objects.filter(pk__in=previous).update(
        company_role=RecruiterProfile.CompanyRole.MEMBER, updated_at=timezone.now()
    )
    target.company_role = RecruiterProfile.CompanyRole.OWNER
    target.save(update_fields=['company_role', 'updated_at'])
    _record_owner_change(
        target=target,
        company=company,
        actor=admin,
        event_type=EmployerCompanyLinkEvent.EventType.OWNER_ASSIGNED,
        reason=reason,
        previous_owner_ids=previous,
    )
    return target
