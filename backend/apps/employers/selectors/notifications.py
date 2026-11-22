from datetime import timedelta

from django.db.models import CharField, Count, OuterRef, Q, Subquery, Value
from django.db.models.functions import Coalesce, TruncDate
from django.utils import timezone

from common.vietnam_time import VIETNAM_TZ, vietnam_day_start, vietnam_today

from ..models import EmployerActivity, EmployerNotification, EmployerNotificationPreference

_Event = EmployerNotification.EventType

# Groups of the activity history and notification pages, each a set of event types.
EMPLOYER_ACTIVITY_CATEGORIES = {
    'applications': (
        _Event.APPLICATION_RECEIVED,
        _Event.APPLICATION_REVIEW_SUBMITTED,
        _Event.APPLICATION_WITHDRAWN,
        _Event.APPLICATION_AWAITING_REPLY,
    ),
    'jobs': (_Event.JOB_CHANGES_REQUESTED, _Event.JOBS_HANDED_OVER),
    'campaigns': (
        _Event.CAMPAIGN_ACTIVATED,
        _Event.CAMPAIGN_ACTIVATION_FAILED,
        _Event.CAMPAIGN_ENDING_SOON,
        _Event.CAMPAIGN_AUTO_COMPLETED,
        _Event.CAMPAIGN_HEALTH_ALERT,
        _Event.SOCIAL_POST_FAILED,
        _Event.SOCIAL_POST_DELETE_FAILED,
        _Event.SOCIAL_CONNECTION_EXPIRED,
        _Event.SOCIAL_CONNECTION_EXPIRING,
    ),
}
# Everything else is about the company: verification, documents, membership, page.
EMPLOYER_ACTIVITY_COMPANY_CATEGORY = 'company'
EMPLOYER_ACTIVITY_PERIOD_DAYS = (7, 30, 90)
# Days in the activity chart of the history page, today included.
EMPLOYER_ACTIVITY_CHART_DAYS = 14
EMPLOYER_EVENT_CATEGORY_KEYS = (*EMPLOYER_ACTIVITY_CATEGORIES, EMPLOYER_ACTIVITY_COMPANY_CATEGORY)
_CATEGORY_BY_EVENT = {
    event: category for category, events in EMPLOYER_ACTIVITY_CATEGORIES.items() for event in events
}


def employer_activity_category(event_type):
    return _CATEGORY_BY_EVENT.get(event_type, EMPLOYER_ACTIVITY_COMPANY_CATEGORY)


def _category_filter(category):
    if category == EMPLOYER_ACTIVITY_COMPANY_CATEGORY:
        return ~Q(event_type__in=list(_CATEGORY_BY_EVENT))
    return Q(event_type__in=EMPLOYER_ACTIVITY_CATEGORIES[category])


def _activities_in_period(user, days):
    queryset = EmployerActivity.objects.filter(recipient=user)
    if days in EMPLOYER_ACTIVITY_PERIOD_DAYS:
        queryset = queryset.filter(occurred_at__gte=timezone.now() - timedelta(days=days))
    return queryset


def _filter_category(queryset, category):
    if category in EMPLOYER_EVENT_CATEGORY_KEYS:
        return queryset.filter(_category_filter(category))
    return queryset


def employer_notification_queryset(user, *, category=None, unread=False):
    queryset = _filter_category(EmployerNotification.objects.filter(recipient=user), category)
    if unread:
        queryset = queryset.filter(read_at__isnull=True)
    return queryset.order_by('-created_at', '-id')


def employer_notification_unread_counts(user):
    """Unread notifications per category tab in one aggregate (``all`` included)."""
    unread = Q(read_at__isnull=True)
    return EmployerNotification.objects.filter(recipient=user).aggregate(
        all=Count('id', filter=unread),
        **{
            key: Count('id', filter=unread & _category_filter(key))
            for key in EMPLOYER_EVENT_CATEGORY_KEYS
        },
    )


def employer_activity_queryset(user, *, category=None, days=None):
    """History page rows, with the in-app link of the notification of the same event."""
    queryset = _filter_category(_activities_in_period(user, days), category)
    action_path = EmployerNotification.objects.filter(
        recipient_id=OuterRef('recipient_id'), dedupe_key=OuterRef('dedupe_key')
    ).values('action_path')[:1]
    return queryset.annotate(
        action_path=Coalesce(Subquery(action_path, output_field=CharField()), Value(''))
    ).order_by('-occurred_at', '-id')


def employer_activity_category_counts(user, *, days=None):
    """Rows per category tab in one aggregate, within the chosen period."""
    return _activities_in_period(user, days).aggregate(
        all=Count('id'),
        **{key: Count('id', filter=_category_filter(key)) for key in EMPLOYER_EVENT_CATEGORY_KEYS},
    )


def employer_unread_notification_count(user):
    return EmployerNotification.objects.filter(recipient=user, read_at__isnull=True).count()


def employer_notification_preference(user):
    """The stored email preferences, or ``None`` while every default still applies."""
    return EmployerNotificationPreference.objects.filter(recipient=user).first()


def employer_activity_daily_counts(user, *, category=None, days=EMPLOYER_ACTIVITY_CHART_DAYS):
    """``[{date, count}]`` for the last ``days`` Vietnamese calendar days, gaps as zero."""
    today = vietnam_today()
    first_day = today - timedelta(days=days - 1)
    rows = (
        _filter_category(
            EmployerActivity.objects.filter(
                recipient=user, occurred_at__gte=vietnam_day_start(first_day)
            ),
            category,
        )
        .annotate(day=TruncDate('occurred_at', tzinfo=VIETNAM_TZ))
        .values('day')
        .annotate(total=Count('id'))
        .order_by()
    )
    by_day = {row['day']: row['total'] for row in rows}
    return [
        {'date': day, 'count': by_day.get(day, 0)}
        for day in (first_day + timedelta(days=offset) for offset in range(days))
    ]
