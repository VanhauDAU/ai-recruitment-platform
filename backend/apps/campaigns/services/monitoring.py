"""Daily health snapshots, alerts on rule transitions, and the weekly report email.

Celery beat runs both every hour; both are idempotent per Vietnam day/week.
"""

import logging
from datetime import date, timedelta

from django.conf import settings
from django.db import IntegrityError, transaction
from django.db.models import Count, Q
from django.template.loader import render_to_string
from django.utils import timezone
from django.utils.translation import gettext as _

from apps.applications.models import Application
from apps.campaigns.models import RecruitmentCampaign
from apps.employers.models import EmployerNotification
from apps.employers.services import campaign_weekly_report_email_enabled, emit_employer_event
from common.email import send_html_email
from common.i18n import recipient_language
from common.vietnam_time import vietnam_now, vietnam_today

from ..models import CampaignChannel, CampaignHealthSnapshot, CampaignReportDelivery
from .health import BACKLOG_ALERT, HEALTH_STATUS_LABELS, campaign_health

logger = logging.getLogger(__name__)
REMIND_EVERY = timedelta(days=7)
REPORT_HOUR = 8
MONITORED = (RecruitmentCampaign.Status.ACTIVE, RecruitmentCampaign.Status.PAUSED)


def _alert_message(rule, campaign, health):
    if rule == 'forecast_at_risk':
        return _(
            'Dự báo chiến dịch "%(campaign)s" tuyển được khoảng %(forecast)s/'
            '%(headcount)s người. Cần khoảng %(velocity)s hồ sơ '
            'mỗi ngày để kịp chỉ tiêu.'
        ) % {
            'campaign': campaign.name,
            'forecast': f'{health["forecast"]:g}',
            'headcount': health['headcount'],
            'velocity': f'{health["required_velocity"] or 0:g}',
        }
    if rule == 'backlog':
        return _('%(count)s hồ sơ của chiến dịch "%(campaign)s" chờ quá 48 giờ chưa được xem.') % {
            'count': health['response']['backlog'],
            'campaign': campaign.name,
        }
    if rule == 'channel_zero_apply':
        labels = ', '.join(channel['label'] for channel in health['silent_channels'][:3])
        return _('Kênh %(channels)s đã đăng nhiều ngày nhưng chưa mang lại hồ sơ nào.') % {
            'channels': labels
        }
    return _('Chi phí chiến dịch "%(campaign)s" đang tiêu nhanh hơn tiến độ thời gian.') % {
        'campaign': campaign.name
    }


def _previous_alerts(campaign, today):
    snapshot = (
        CampaignHealthSnapshot.objects.filter(campaign=campaign, date__lte=today)
        .order_by('-date')
        .first()
    )
    return snapshot.open_alerts if snapshot else {}


@transaction.atomic
def snapshot_campaign(campaign, *, now=None):
    """Store today's health and notify rules that started failing (or still fail a week on)."""
    now = now or timezone.now()
    today = vietnam_today(now)
    health = campaign_health(campaign, now=now)
    previous = _previous_alerts(campaign, today)
    open_alerts = {}
    for rule in health['alerts']:
        entry = dict(previous.get(rule) or {'since': today.isoformat()})
        notified = entry.get('notified')
        if not notified or today - date.fromisoformat(notified) >= REMIND_EVERY:
            with recipient_language(campaign.owner.user):
                emit_employer_event(
                    recipient=campaign.owner.user,
                    event_type=EmployerNotification.EventType.CAMPAIGN_HEALTH_ALERT,
                    dedupe_key=f'campaign-health:{campaign.public_id}:{rule}:{today.isoformat()}',
                    message=_alert_message(rule, campaign, health),
                    subject_public_id=campaign.public_id,
                    metadata={'campaign_public_id': campaign.public_id, 'rule': rule},
                    action_path=f'/tuyendung/app/campaigns/{campaign.public_id}?active_tab=health',
                )
            entry['notified'] = today.isoformat()
        open_alerts[rule] = entry
    CampaignHealthSnapshot.objects.update_or_create(
        campaign=campaign,
        date=today,
        defaults={'status': health['status'], 'metrics': health, 'open_alerts': open_alerts},
    )
    return health


def run_health_snapshots(*, now=None):
    campaigns = RecruitmentCampaign.objects.filter(
        status__in=MONITORED, policy_hold=RecruitmentCampaign.PolicyHold.NONE
    ).select_related('owner__user')
    count = 0
    for campaign in campaigns:
        snapshot_campaign(campaign, now=now)
        count += 1
    return count


def _top_channels(campaign):
    return list(
        CampaignChannel.objects.filter(campaign=campaign)
        .annotate(total=Count('applications', filter=Q(applications__is_current=True)))
        .order_by('-total', 'label')
        .values('label', 'total')[:3]
    )


def weekly_report_context(campaign, health, *, now):
    week_ago = now - timedelta(days=7)
    return {
        'campaign': campaign,
        'health': health,
        'status_label': HEALTH_STATUS_LABELS.get(health['status'], ''),
        'new_applications': Application.objects.filter(
            job__campaign=campaign, is_current=True, applied_at__gte=week_ago
        ).count(),
        'top_channels': _top_channels(campaign),
        'backlog_alert': health['response']['backlog'] >= BACKLOG_ALERT,
        'campaign_url': (
            f'{settings.EMPLOYER_FRONTEND_URL.rstrip("/")}'
            f'/tuyendung/app/campaigns/{campaign.public_id}?active_tab=health'
        ),
    }


def _send_weekly_report(campaign, *, now):
    recipient = campaign.owner.user
    context = weekly_report_context(campaign, campaign_health(campaign, now=now), now=now)
    with recipient_language(recipient):
        send_html_email(
            subject=_('Báo cáo tuần: %(campaign)s') % {'campaign': campaign.name},
            text=render_to_string('campaigns/email/weekly_report.txt', context),
            html=render_to_string('campaigns/email/weekly_report.html', context),
            to=recipient.email,
        )


def send_weekly_reports(*, now=None):
    """From 08:00 every Monday (Vietnam time), one email per running campaign and week."""
    now = now or timezone.now()
    local = vietnam_now(now)
    if local.weekday() != 0 or local.hour < REPORT_HOUR:
        return 0
    sent = 0
    campaigns = RecruitmentCampaign.objects.filter(
        status__in=MONITORED,
        policy_hold=RecruitmentCampaign.PolicyHold.NONE,
        owner__user__is_active=True,
    ).select_related('owner__user')
    for campaign in campaigns:
        if not campaign_weekly_report_email_enabled(campaign.owner.user):
            continue
        try:
            with transaction.atomic():
                CampaignReportDelivery.objects.create(campaign=campaign, week_start=local.date())
                _send_weekly_report(campaign, now=now)
        except IntegrityError:
            continue  # already sent this week
        except Exception:  # noqa: BLE001 - one failing mailbox must not stop the others
            logger.exception(
                'campaign_weekly_report_failed', extra={'campaign': campaign.public_id}
            )
            continue
        sent += 1
    return sent
