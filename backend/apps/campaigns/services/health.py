"""Campaign health: explainable indicators and a hiring forecast against the target.

Every number comes from data already recorded (applications and their stage
timestamps, channel clicks and costs). A figure whose denominator is not there
yet is ``None`` and shown as "—" rather than guessed. Formulas and thresholds
are documented in docs/07-algorithms/suc-khoe-chien-dich.md.
"""

from datetime import timedelta
from statistics import median

from django.db.models import Count, Q, Sum
from django.utils import timezone

from apps.applications.models import Application
from apps.jobs.models import Job
from common.vietnam_time import vietnam_today

from ..models import (
    CampaignChannel,
    CampaignChannelClickDaily,
    CampaignChannelCost,
    CampaignHealthSnapshot,
)

# Hire probability of an application still open at a stage, used until the
# campaign has MIN_STAGE_SAMPLE decided applications that reached that stage.
DEFAULT_STAGE_HIRE_RATE = {'new': 0.05, 'shortlisted': 0.2, 'interviewed': 0.4}
MIN_STAGE_SAMPLE = 20
PRIOR_HIRE_RATE = 0.05  # p0: share of applications that end in a hire
PRIOR_WEIGHT = 10  # alpha: pseudo-applications standing behind the prior
CONTINUOUS_HORIZON_DAYS = 30
MIN_DAYS, MIN_APPLICATIONS = 3, 5
AT_RISK_RATIO = 0.7
RESPONSE_WINDOW = timedelta(hours=48)
BACKLOG_ALERT = 5
CHANNEL_SILENT_DAYS = 5
OVERBURN_RATIO = 1.2
# Nhãn tình trạng cho email cảnh báo và file báo cáo, cùng nguồn với enum đã lưu.
HEALTH_STATUS_LABELS = dict(CampaignHealthSnapshot.Status.choices)

S = Application.Status
DECIDED = {S.ACCEPTED, S.REJECTED, S.WITHDRAWN}


def _round(value, digits=1):
    return None if value is None else round(value, digits)


def _reached(row, stage):
    if stage == 'new':
        return True
    if stage == 'shortlisted':
        return bool(row['shortlisted_at'] or row['interviewed_at'] or row['accepted_at'])
    return bool(row['interviewed_at'] or row['accepted_at'])


def _open_stage(row):
    if row['status'] in DECIDED:
        return None
    if row['status'] == S.INTERVIEWED:
        return 'interviewed'
    if row['status'] == S.SHORTLISTED:
        return 'shortlisted'
    return 'new'


def _stage_rates(rows):
    """Hire rate per stage: the campaign's own once enough are decided, else the default."""
    rates, sources = {}, {}
    for stage, default in DEFAULT_STAGE_HIRE_RATE.items():
        decided = [row for row in rows if _reached(row, stage) and row['status'] in DECIDED]
        if len(decided) >= MIN_STAGE_SAMPLE:
            rates[stage] = sum(1 for row in decided if row['status'] == S.ACCEPTED) / len(decided)
            sources[stage] = 'campaign'
        else:
            rates[stage], sources[stage] = default, 'default'
    return rates, sources


def _response(rows, now):
    durations = [
        (row['viewed_at'] - row['applied_at']).total_seconds() / 3600
        for row in rows
        if row['viewed_at'] and row['applied_at'] >= now - timedelta(days=30)
    ]
    old_enough = [row for row in rows if row['applied_at'] <= now - RESPONSE_WINDOW]
    on_time = [
        row
        for row in old_enough
        if row['viewed_at'] and row['viewed_at'] - row['applied_at'] <= RESPONSE_WINDOW
    ]
    return {
        'median_hours_to_view': _round(median(durations)) if durations else None,
        'viewed_within_48h_percent': (
            _round(len(on_time) * 100 / len(old_enough)) if old_enough else None
        ),
        'backlog': sum(
            1
            for row in rows
            if row['status'] == S.SUBMITTED and row['applied_at'] <= now - RESPONSE_WINDOW
        ),
    }


def _funnel(rows):
    total = len(rows)
    reached = {
        'viewed': sum(1 for row in rows if row['viewed_at'] or row['status'] != S.SUBMITTED),
        'shortlisted': sum(1 for row in rows if _reached(row, 'shortlisted')),
        'interviewed': sum(1 for row in rows if _reached(row, 'interviewed')),
        'accepted': sum(1 for row in rows if row['status'] == S.ACCEPTED),
    }
    return [
        {
            'stage': stage,
            'count': count,
            'percent_of_applications': _round(count * 100 / total) if total else None,
        }
        for stage, count in [('applied', total), *reached.items()]
    ]


def _budget(campaign, active_days):
    spent = (
        CampaignChannelCost.objects.filter(channel__campaign=campaign).aggregate(
            total=Sum('amount')
        )['total']
        or 0
    )
    budget = campaign.budget_max
    planned_days = None
    if campaign.start_date and campaign.target_date and not campaign.is_continuous:
        planned_days = (campaign.target_date - campaign.start_date).days + 1
    used = spent / budget if budget else None
    elapsed = active_days / planned_days if planned_days and active_days else None
    return {
        'spent': spent,
        'budget_max': budget,
        'used_percent': _round(used * 100) if used is not None else None,
        'burn_ratio': _round(used / elapsed, 2) if used is not None and elapsed else None,
    }


def _silent_channels(campaign, now):
    """Channels posted for a while that brought no application yet."""
    channels = (
        CampaignChannel.objects.filter(
            campaign=campaign, posted_at__lte=now - timedelta(days=CHANNEL_SILENT_DAYS)
        )
        .annotate(
            current_applications=Count('applications', filter=Q(applications__is_current=True))
        )
        .filter(current_applications=0)
    )
    clicks = dict(
        CampaignChannelClickDaily.objects.filter(channel__in=channels)
        .values_list('channel_id')
        .annotate(total=Sum('unique_click_count'))
    )
    return [{'label': channel.label, 'clicks': clicks.get(channel.pk, 0)} for channel in channels]


def _status(*, headcount, accepted, forecast, active_days, applications):
    if not headcount:
        return 'no_target'
    if accepted >= headcount:
        return 'achieved'
    if active_days < MIN_DAYS or applications < MIN_APPLICATIONS:
        return 'insufficient_data'
    if forecast >= headcount:
        return 'on_track'
    return 'at_risk' if forecast >= AT_RISK_RATIO * headcount else 'off_track'


def campaign_health(campaign, *, now=None):
    """Indicators, forecast and alert rules for one campaign (a fixed number of queries)."""
    now = now or timezone.now()
    today = vietnam_today(now)
    rows = list(
        Application.objects.filter(job__campaign=campaign, is_current=True).values(
            'status', 'applied_at', 'viewed_at', 'shortlisted_at', 'interviewed_at', 'accepted_at'
        )
    )
    headcount = (
        Job.objects.filter(campaign=campaign).aggregate(total=Sum('number_of_vacancies'))['total']
        or 0
    )
    active_days = campaign.active_seconds(now=now) / 86400
    applications = len(rows)
    accepted = sum(1 for row in rows if row['status'] == S.ACCEPTED)
    last_7 = sum(1 for row in rows if row['applied_at'] >= now - timedelta(days=7))
    velocity_7 = last_7 / min(7, active_days) if active_days >= 1 else None
    hire_rate = (accepted + PRIOR_WEIGHT * PRIOR_HIRE_RATE) / (applications + PRIOR_WEIGHT)
    rates, rate_sources = _stage_rates(rows)
    pipeline = {stage: 0 for stage in DEFAULT_STAGE_HIRE_RATE}
    for row in rows:
        if stage := _open_stage(row):
            pipeline[stage] += 1
    expected_from_pipeline = sum(pipeline[stage] * rates[stage] for stage in pipeline)
    if campaign.is_continuous or not campaign.target_date:
        days_left = CONTINUOUS_HORIZON_DAYS
    else:
        days_left = max((campaign.target_date - today).days, 0)
    expected_new = (velocity_7 or 0) * days_left * hire_rate
    forecast = accepted + expected_from_pipeline + expected_new
    remaining = headcount - accepted - expected_from_pipeline
    required_velocity = (
        remaining / (hire_rate * days_left) if remaining > 0 and days_left > 0 else None
    )
    status = _status(
        headcount=headcount,
        accepted=accepted,
        forecast=forecast,
        active_days=active_days,
        applications=applications,
    )
    response = _response(rows, now)
    budget = _budget(campaign, active_days)
    silent = _silent_channels(campaign, now)
    alerts = []
    if status in {'at_risk', 'off_track'}:
        alerts.append('forecast_at_risk')
    if response['backlog'] >= BACKLOG_ALERT:
        alerts.append('backlog')
    if silent:
        alerts.append('channel_zero_apply')
    if budget['burn_ratio'] is not None and budget['burn_ratio'] > OVERBURN_RATIO:
        alerts.append('budget_overburn')
    return {
        'status': status,
        'headcount': headcount,
        'accepted': accepted,
        'applications': applications,
        'active_days': _round(active_days),
        'days_left': days_left,
        'velocity_7d': _round(velocity_7, 2),
        'velocity_all': _round(applications / active_days, 2) if active_days >= 1 else None,
        'hire_rate': round(hire_rate, 3),
        'stage_rates': {stage: round(rate, 3) for stage, rate in rates.items()},
        'stage_rate_sources': rate_sources,
        'pipeline': pipeline,
        'forecast': round(forecast, 1),
        'required_velocity': _round(required_velocity, 2),
        'funnel': _funnel(rows),
        'response': response,
        'budget': budget,
        'silent_channels': silent,
        'alerts': alerts,
    }
