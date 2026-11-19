"""Per-account activity timeline merged from every append-only source.

Each source returns at most ``limit + 1`` normalised entries strictly after
the cursor, newest first; ``merge_entries`` interleaves them. A page therefore
costs one query per source (eight at most), plus one count per source on the
first page.
"""

import uuid
from collections.abc import Callable
from dataclasses import dataclass

from django.db.models import Count, Q
from django.utils.translation import gettext as _

from apps.employers.models import (
    CompanyDocument,
    CompanyUpdateEvent,
    EmployerActivity,
    EmployerCompanyLinkEvent,
    EmployerNotification,
    EmployerPhoneVerificationEvent,
    EmployerVerificationEvent,
)

from ..domain import account_activity as rules
from ..models import AccountStatusTransition, AdminAccessAuditLog, AuthSession

_DOC_TYPE_LABELS = dict(CompanyDocument.DocType.choices)
_EMPLOYER_EVENT_LABELS = dict(EmployerNotification.EventType.choices)


def _actor(user, actor, identifier=''):
    if actor is None:
        if identifier:
            return {'type': 'admin', 'label': identifier}
        return {'type': 'system', 'label': _('Hệ thống')}
    if actor.pk == user.pk:
        return {'type': 'self', 'label': _('Chính tài khoản')}
    if actor.is_admin_role:
        return {'type': 'admin', 'label': actor.email}
    return {'type': 'member', 'label': actor.full_name or actor.email}


def _detail(label, value, kind='text'):
    return {'label': label, 'value': value, 'type': kind} if value not in (None, '') else None


def _entry(source, rank, obj, *, occurred_at, category, event, title, actor, **extra):
    details = [item for item in extra.pop('details', ()) if item]
    return {
        'id': f'{source}:{obj.pk}',
        'category': category,
        'event': event,
        'title': title,
        'summary': extra.get('summary', ''),
        'tone': extra.get('tone', rules.NEUTRAL),
        'actor': actor,
        'occurred_at': occurred_at,
        'details': details,
        '_rank': rank,
        '_pk': obj.pk,
    }


# ---------------------------------------------------------------- sources ---


def _sessions(user):
    return AuthSession.objects.filter(user=user)


def _session_entry(user, session):
    method = rules.AUTH_METHOD_LABELS.get(session.auth_method, session.auth_method)
    portal = rules.PORTAL_LABELS.get(session.portal, session.portal)
    return dict(
        category=rules.SECURITY,
        event='login',
        title=_('Đăng nhập %(portal)s') % {'portal': portal},
        summary=' · '.join(str(part) for part in (method, session.device_label) if part),
        actor={'type': 'self', 'label': _('Chính tài khoản')},
        details=[
            _detail(_('Thiết bị'), session.device_label),
            _detail(_('Địa chỉ IP'), session.ip_address),
            _detail(_('Phương thức'), method),
            _detail(_('Đã đăng xuất lúc'), session.revoked_at, 'datetime'),
        ],
    )


def _audit(user):
    return AdminAccessAuditLog.objects.filter(
        target_type='user',
        target_public_id=user.public_id,
        action__in=rules.USER_TARGET_AUDIT_ACTIONS,
    ).select_related('actor')


def _audit_category_filter(category):
    actions = [code for code, meta in rules.AUDIT_ACTION_META.items() if meta[0] == category]
    return Q(action__in=actions)


def _audit_entry(user, log):
    category, title, tone = rules.audit_meta(log.action)
    payload = log.payload or {}
    changed = payload.get('changed_fields') or payload.get('fields') or []
    revoked = payload.get('revoked_session_count')
    return dict(
        category=category,
        event=log.action,
        title=title,
        tone=tone,
        summary=payload.get('reason', ''),
        actor=_actor(user, log.actor, log.actor_identifier),
        details=[
            _detail(_('Lý do'), payload.get('reason')),
            _detail(_('Số trường đã sửa'), len(changed) or None),
            _detail(_('Phiên bị thu hồi'), revoked),
            _detail(_('Email cũ'), payload.get('before_email')),
            _detail(_('Email mới'), payload.get('after_email')),
        ],
    )


def _transitions(user):
    return AccountStatusTransition.objects.filter(user=user).select_related('actor')


def _transition_entry(user, transition):
    title, tone = rules.STATUS_KIND_META.get(
        transition.kind, (_('Đổi trạng thái tài khoản'), 'neutral')
    )
    return dict(
        category=rules.ACCOUNT,
        event=transition.kind,
        title=title,
        tone=tone,
        summary=transition.reason,
        actor=_actor(user, transition.actor),
        details=[
            _detail(
                _('Trạng thái'),
                rules.status_change_label(transition.before_status, transition.after_status)
                if transition.before_status != transition.after_status
                else None,
            ),
            _detail(_('Lý do'), transition.reason),
            _detail(
                _('Nhóm vi phạm'),
                rules.VIOLATION_CATEGORY_LABELS.get(transition.violation_category),
            ),
        ],
    )


def _verification_events(user):
    return EmployerVerificationEvent.objects.filter(
        verification_case__recruiter__user=user
    ).select_related('actor')


def _verification_entry(user, event):
    payload = event.payload or {}
    doc_label = _DOC_TYPE_LABELS.get(payload.get('doc_type'), '')
    decision = rules.DECISION_LABELS.get(payload.get('decision'), '')
    return dict(
        category=rules.VERIFICATION,
        event=event.event_type,
        title=rules.VERIFICATION_EVENT_TITLES.get(event.event_type, event.get_event_type_display()),
        tone=rules.verification_tone(event.event_type),
        summary=': '.join(str(part) for part in (doc_label, decision) if part),
        actor=_actor(user, event.actor),
        details=[_detail(_('Giấy tờ'), doc_label), _detail(_('Lý do'), payload.get('reason'))],
    )


def _phone_events(user):
    return EmployerPhoneVerificationEvent.objects.filter(
        user=user,
        event_type__in=list(rules.PHONE_EVENT_META),
    )


def _phone_entry(user, event):
    title, tone = rules.PHONE_EVENT_META[event.event_type]
    return dict(
        category=rules.VERIFICATION,
        event=f'phone_{event.event_type}',
        title=title,
        tone=tone,
        actor=(
            {'type': 'self', 'label': _('Chính tài khoản')}
            if event.event_type == EmployerPhoneVerificationEvent.EventType.VERIFIED
            else {'type': 'system', 'label': _('Hệ thống')}
        ),
    )


def _link_events(user):
    return EmployerCompanyLinkEvent.objects.filter(recruiter__user=user).select_related(
        'actor', 'company'
    )


def _link_entry(user, event):
    return dict(
        category=rules.COMPANY,
        event=event.event_type,
        title=event.get_event_type_display(),
        tone=rules.company_link_tone(event.event_type),
        summary=event.reason,
        actor=_actor(user, event.actor),
        details=[
            _detail(_('Công ty'), event.company.company_name),
            _detail(_('Lý do'), event.reason),
        ],
    )


def _company_update_events(user):
    return CompanyUpdateEvent.objects.filter(update_request__requested_by=user).select_related(
        'actor', 'update_request__company'
    )


def _company_update_entry(user, event):
    payload = event.payload or {}
    return dict(
        category=rules.COMPANY,
        event=f'company_update_{event.event_type}',
        title=rules.COMPANY_UPDATE_EVENT_TITLES.get(
            event.event_type, event.get_event_type_display()
        ),
        tone=rules.company_update_tone(event.event_type),
        summary=event.update_request.company.company_name,
        actor=_actor(user, event.actor),
        details=[
            _detail(_('Phiên bản'), event.revision_number),
            _detail(_('Lý do'), payload.get('reason')),
        ],
    )


def _employer_activity(user):
    return (
        EmployerActivity.objects.filter(recipient=user)
        .exclude(event_type__in=rules.EMPLOYER_ACTIVITY_DUPLICATES)
        .select_related('actor')
    )


def _employer_activity_category_filter(category):
    company_events = Q(event_type__in=rules.EMPLOYER_ACTIVITY_COMPANY_EVENTS)
    return company_events if category == rules.COMPANY else ~company_events


def _employer_activity_entry(user, activity):
    return dict(
        category=rules.employer_activity_category(activity.event_type),
        event=activity.event_type,
        title=_EMPLOYER_EVENT_LABELS.get(activity.event_type, activity.event_type),
        tone=rules.employer_activity_tone(activity.event_type),
        summary=activity.summary,
        actor=_actor(user, activity.actor),
    )


@dataclass(frozen=True)
class _Source:
    key: str
    rank: int
    time_field: str
    categories: tuple
    queryset: Callable
    to_entry: Callable
    employer_only: bool = True
    category_filter: Callable | None = None
    pk_type: type = int


SOURCES = (
    _Source(
        'auth',
        1,
        'created_at',
        (rules.SECURITY,),
        _sessions,
        _session_entry,
        employer_only=False,
        pk_type=uuid.UUID,
    ),
    _Source(
        'audit',
        2,
        'created_at',
        (rules.SECURITY, rules.ACCOUNT),
        _audit,
        _audit_entry,
        employer_only=False,
        category_filter=_audit_category_filter,
    ),
    _Source(
        'status',
        3,
        'created_at',
        (rules.ACCOUNT,),
        _transitions,
        _transition_entry,
        employer_only=False,
    ),
    _Source(
        'vevt', 4, 'created_at', (rules.VERIFICATION,), _verification_events, _verification_entry
    ),
    _Source('phone', 5, 'occurred_at', (rules.VERIFICATION,), _phone_events, _phone_entry),
    _Source('link', 6, 'created_at', (rules.COMPANY,), _link_events, _link_entry),
    _Source(
        'cupd', 7, 'created_at', (rules.COMPANY,), _company_update_events, _company_update_entry
    ),
    _Source(
        'eact',
        8,
        'occurred_at',
        (rules.COMPANY, rules.RECRUITMENT),
        _employer_activity,
        _employer_activity_entry,
        category_filter=_employer_activity_category_filter,
    ),
)


def _sources_for(user, category):
    for source in SOURCES:
        if source.employer_only and not user.is_employer:
            continue
        if category and category not in source.categories:
            continue
        queryset = source.queryset(user)
        if category and source.category_filter:
            queryset = queryset.filter(source.category_filter(category))
        yield source, queryset


def _after_cursor(source, cursor):
    """Rows strictly older than the cursor in the (time, rank, pk) order."""
    if cursor is None:
        return Q()
    occurred_at, rank, pk_text = cursor
    older = Q(**{f'{source.time_field}__lt': occurred_at})
    if source.rank < rank:
        return older | Q(**{source.time_field: occurred_at})
    if source.rank > rank:
        return older
    try:
        pk = source.pk_type(pk_text)
    except (TypeError, ValueError):
        return older
    return older | Q(**{source.time_field: occurred_at, 'pk__lt': pk})


def account_activity_timeline(user, *, category='', cursor=None, limit=rules.DEFAULT_LIMIT):
    pages = []
    for source, queryset in _sources_for(user, category):
        rows = queryset.filter(_after_cursor(source, cursor)).order_by(
            f'-{source.time_field}', '-pk'
        )[: limit + 1]
        pages.append(
            [
                _entry(
                    source.key,
                    source.rank,
                    row,
                    occurred_at=getattr(row, source.time_field),
                    **source.to_entry(user, row),
                )
                for row in rows
            ]
        )
    page, has_more = rules.merge_entries(pages, limit)
    return {
        'results': [rules.public_entry(entry) for entry in page],
        'next_cursor': rules.encode_cursor(page[-1]) if has_more and page else None,
    }


def account_activity_counts(user):
    counts = dict.fromkeys(rules.CATEGORIES, 0)
    for source, queryset in _sources_for(user, ''):
        if source.category_filter is None:
            counts[source.categories[0]] += queryset.count()
            continue
        totals = queryset.aggregate(
            **{
                category: Count('pk', filter=source.category_filter(category))
                for category in source.categories
            }
        )
        for category, value in totals.items():
            counts[category] += value
    counts['all'] = sum(counts[category] for category in rules.CATEGORIES)
    return counts
