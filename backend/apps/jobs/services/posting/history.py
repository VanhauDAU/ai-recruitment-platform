"""Status history and campaign activity written alongside posting transitions."""

from apps.campaigns.models import CampaignActivity

from ...models import JobStatusHistory


def _record_status(
    job,
    *,
    from_status,
    to_status,
    user,
    note='',
    actor_role=JobStatusHistory.ActorRole.EMPLOYER,
):
    JobStatusHistory.objects.create(
        job=job,
        from_status=from_status,
        to_status=to_status,
        changed_by=user,
        actor_role=actor_role,
        note=note,
    )
    if job.campaign_id:
        CampaignActivity.objects.record(
            campaign=job.campaign,
            event_type=CampaignActivity.EventType.JOB_STATUS_CHANGED,
            group=CampaignActivity.Group.JOB,
            actor=user,
            subject_public_id=job.public_id,
            metadata={
                'title': job.title,
                'from_status': from_status,
                'to_status': to_status,
            },
        )


def _record_job_assignment(job, *, previous_campaign, user):
    if previous_campaign and previous_campaign.pk != job.campaign_id:
        CampaignActivity.objects.record(
            campaign=previous_campaign,
            event_type=CampaignActivity.EventType.JOB_REMOVED,
            group=CampaignActivity.Group.JOB,
            actor=user,
            subject_public_id=job.public_id,
            metadata={'title': job.title},
        )
    if job.campaign_id and (previous_campaign is None or previous_campaign.pk != job.campaign_id):
        CampaignActivity.objects.record(
            campaign=job.campaign,
            event_type=CampaignActivity.EventType.JOB_ADDED,
            group=CampaignActivity.Group.JOB,
            actor=user,
            subject_public_id=job.public_id,
            metadata={'title': job.title},
        )
    elif job.campaign_id:
        CampaignActivity.objects.record(
            campaign=job.campaign,
            event_type=CampaignActivity.EventType.JOB_UPDATED,
            group=CampaignActivity.Group.JOB,
            actor=user,
            subject_public_id=job.public_id,
            metadata={'title': job.title},
        )
