"""Revoking or expiring an approved verification, with preview and confirmation."""

from django.db import transaction
from django.utils import timezone
from django.utils.translation import gettext

from apps.accounts.api.permissions import require_admin
from apps.accounts.services import (
    StaleImpactToken,
    create_impact_token,
    decode_impact_token,
    record_admin_action,
)

from ...models import (
    EmployerComplianceHold,
    EmployerVerificationCase,
    EmployerVerificationEvent,
)
from ..compliance import (
    apply_verification_hold,
    lock_verification_identity,
)
from .cases import queue_verification_notification, workflow_error
from .impact import (
    integrity_fingerprint,
    public_job_ids,
    resource_rows,
    verification_snapshot_scope,
)

LIFECYCLE_ACTIONS = frozenset(
    {
        EmployerVerificationCase.Status.REVOKED,
        EmployerVerificationCase.Status.EXPIRED,
    }
)


def _prepare_lifecycle_action(case, *, actor, action, reason, scope=None, require_reason=True):
    require_admin(actor)
    scope = scope or verification_snapshot_scope(case)
    if action not in LIFECYCLE_ACTIONS:
        workflow_error(
            'VERIFICATION_LIFECYCLE_ACTION_INVALID',
            gettext('Thao tác vòng đời xác thực không hợp lệ.'),
        )
    if case.status != EmployerVerificationCase.Status.APPROVED:
        workflow_error(
            'VERIFICATION_INVALID_TRANSITION',
            gettext('Chỉ hồ sơ đã duyệt mới có thể bị thu hồi hoặc hết hiệu lực.'),
            current_status=case.status,
            allowed_statuses=[EmployerVerificationCase.Status.APPROVED],
        )
    reason = reason.strip()
    if require_reason and not reason:
        workflow_error(
            'VERIFICATION_REASON_REQUIRED',
            gettext('Cần nhập lý do cho thay đổi hiệu lực xác thực.'),
        )
    _, jobs, campaigns, _ = resource_rows(case, scope=scope)
    campaign_count = len(campaigns)
    job_count = len(jobs)
    active_job_count = len(public_job_ids(case, scope=scope))
    snapshot = {
        'case_public_id': case.public_id,
        'case_revision': case.revision,
        'lock_version': case.lock_version,
        'action': action,
        'reason': reason,
        'capability_impact': {
            'candidate_data_access': 'blocked',
            'job_approval': 'blocked',
            'job_workspace': 'unchanged',
            'job_create_edit_submit': 'unchanged',
        },
        'resources': {
            'campaign_count': campaign_count,
            'job_count': job_count,
            'active_jobs_hidden_from_public': active_job_count,
        },
        'integrity_fingerprint': integrity_fingerprint(case, scope=scope),
    }
    return {'action': action, 'reason': reason}, snapshot


def verification_lifecycle_impact(case, *, actor, action, reason):
    payload, snapshot = _prepare_lifecycle_action(
        case,
        actor=actor,
        action=action,
        reason=reason,
        require_reason=False,
    )
    return {
        **{key: value for key, value in snapshot.items() if key != 'integrity_fingerprint'},
        'impact_token': create_impact_token(
            revision=case.lock_version,
            operation='employer_verification.lifecycle',
            resource_key=case.public_id,
            normalized_payload={'request': payload, 'snapshot': snapshot},
        ),
    }


@transaction.atomic
def confirm_verification_lifecycle_action(
    case,
    *,
    actor,
    action,
    reason,
    impact_token,
):
    scope = lock_verification_identity(case, include_resources=True)
    case = scope.case
    payload, snapshot = _prepare_lifecycle_action(
        case,
        actor=actor,
        action=action,
        reason=reason,
        scope=scope,
    )
    claims = decode_impact_token(
        impact_token,
        operation='employer_verification.lifecycle',
        resource_key=case.public_id,
        normalized_payload={'request': payload, 'snapshot': snapshot},
    )
    if claims['revision'] != case.lock_version:
        raise StaleImpactToken(gettext('Hồ sơ đã thay đổi sau khi xem tác động.'))

    hold_reason = {
        EmployerVerificationCase.Status.REVOKED: (
            EmployerComplianceHold.Reason.VERIFICATION_REVOKED
        ),
        EmployerVerificationCase.Status.EXPIRED: (
            EmployerComplianceHold.Reason.VERIFICATION_EXPIRED
        ),
    }[action]
    case.status = action
    case.reviewer = actor
    case.decided_at = timezone.now()
    case.decision_reason = payload['reason']
    case.decision_source = EmployerVerificationCase.DecisionSource.EXPLICIT_ADMIN
    case.decision_snapshot = snapshot
    case.tax_override_reason = ''
    case.tax_override_by = None
    case.lock_version += 1
    case.save(
        update_fields=[
            'status',
            'reviewer',
            'decided_at',
            'decision_reason',
            'decision_source',
            'decision_snapshot',
            'tax_override_reason',
            'tax_override_by',
            'lock_version',
            'updated_at',
        ]
    )
    hold, created = apply_verification_hold(scope, reason=hold_reason, actor=actor)
    event_type = {
        EmployerVerificationCase.Status.REVOKED: EmployerVerificationEvent.EventType.REVOKED,
        EmployerVerificationCase.Status.EXPIRED: EmployerVerificationEvent.EventType.EXPIRED,
    }[action]
    EmployerVerificationEvent.objects.create(
        verification_case=case,
        actor=actor,
        event_type=event_type,
        payload={
            'reason': payload['reason'],
            'revision': case.revision,
        },
    )
    if created:
        EmployerVerificationEvent.objects.create(
            verification_case=case,
            actor=actor,
            event_type=EmployerVerificationEvent.EventType.HOLD_APPLIED,
            payload={
                'hold_public_id': hold.public_id,
                'source': hold.source,
                'reason': hold.reason,
                'campaign_count': len(scope.campaigns),
                'job_count': len(scope.jobs),
            },
        )
    record_admin_action(
        actor=actor,
        action=f'{action}_employer_verification',
        target_type='employer_verification',
        target_public_id=case.public_id,
        payload={
            'reason': payload['reason'],
            'hold_public_id': hold.public_id,
        },
    )
    queue_verification_notification(case, event_type=action, reason=reason)
    return case
