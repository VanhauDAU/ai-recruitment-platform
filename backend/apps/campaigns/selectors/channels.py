"""Channel comparison: clicks, applications, hires and cost per channel, plus organic sources."""

from django.db.models import Count, IntegerField, OuterRef, Q, Subquery, Sum
from django.db.models.functions import Coalesce

from apps.applications.models import Application

from ..models import CampaignChannel, CampaignChannelClickDaily, CampaignChannelCost

ORGANIC_SOURCES = (
    (Application.Source.INVITED, 'Mời từ kho ứng viên'),
    (Application.Source.RECOMMENDED, 'Gợi ý của ProCV'),
    (Application.Source.APPLIED, 'Tự tìm thấy trên ProCV'),
)


def _sum_subquery(model, field, **filters):
    rows = (
        model.objects.filter(channel_id=OuterRef('pk'), **filters)
        .values('channel_id')
        .annotate(total=Sum(field))
        .values('total')[:1]
    )
    return Coalesce(Subquery(rows, output_field=IntegerField()), 0)


def campaign_channels_queryset(campaign):
    current = Application.objects.filter(campaign_channel_id=OuterRef('pk'), is_current=True)

    def application_count(**filters):
        rows = current.filter(**filters).values('campaign_channel_id').annotate(n=Count('id'))
        return Coalesce(Subquery(rows.values('n')[:1], output_field=IntegerField()), 0)

    return (
        CampaignChannel.objects.filter(campaign=campaign)
        .select_related('job')
        .annotate(
            clicks=_sum_subquery(CampaignChannelClickDaily, 'click_count'),
            unique_clicks=_sum_subquery(CampaignChannelClickDaily, 'unique_click_count'),
            previews=_sum_subquery(CampaignChannelClickDaily, 'preview_count'),
            application_count=application_count(),
            hire_count=application_count(status=Application.Status.ACCEPTED),
            cost=_sum_subquery(CampaignChannelCost, 'amount'),
        )
    )


def _rate(numerator, denominator, scale=100):
    return round(numerator * scale / denominator, 1) if denominator else None


def _per(cost, count):
    return round(cost / count) if count and cost else None


def campaign_channel_report(campaign):
    """One row per channel and per organic source, with totals against the budget."""
    rows = [
        {
            'key': channel.public_id,
            'label': channel.label,
            'kind': channel.kind,
            'clicks': channel.clicks,
            'unique_clicks': channel.unique_clicks,
            'applications': channel.application_count,
            'hires': channel.hire_count,
            'cost': channel.cost,
            'apply_rate': _rate(channel.application_count, channel.unique_clicks),
            'cost_per_application': _per(channel.cost, channel.application_count),
            'cost_per_hire': _per(channel.cost, channel.hire_count),
        }
        for channel in campaign_channels_queryset(campaign)
    ]
    organic = (
        Application.objects.filter(
            job__campaign=campaign, is_current=True, campaign_channel__isnull=True
        )
        .values('source')
        .annotate(
            applications=Count('id'),
            hires=Count('id', filter=Q(status=Application.Status.ACCEPTED)),
        )
    )
    by_source = {row['source']: row for row in organic}
    for source, label in ORGANIC_SOURCES:
        row = by_source.get(source, {'applications': 0, 'hires': 0})
        rows.append(
            {
                'key': f'organic:{source}',
                'label': label,
                'kind': 'organic',
                'clicks': None,
                'unique_clicks': None,
                'applications': row['applications'],
                'hires': row['hires'],
                'cost': 0,
                'apply_rate': None,
                'cost_per_application': None,
                'cost_per_hire': None,
            }
        )
    spent = sum(row['cost'] for row in rows)
    applications = sum(row['applications'] for row in rows)
    hires = sum(row['hires'] for row in rows)
    return {
        'rows': rows,
        'totals': {
            'cost': spent,
            'applications': applications,
            'hires': hires,
            'cost_per_application': _per(spent, applications),
            'cost_per_hire': _per(spent, hires),
            'budget_max': campaign.budget_max,
            'budget_used_percent': _rate(spent, campaign.budget_max)
            if campaign.budget_max
            else None,
        },
    }
