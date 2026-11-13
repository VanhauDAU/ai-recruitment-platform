from django.db import migrations

# Post-moderation (ADR-0014) removes the review queue. Every job still waiting
# for, or refused by, an administrator returns to the recruiter as a draft. The
# `publish_converted_pending_jobs` command then republishes former pending jobs
# through the normal publish workflow, so only eligible ones become public.
CONVERSION_NOTE = 'Chuyển về bản nháp khi bỏ quy trình duyệt tin (ADR-0014).'


def convert_review_states_to_draft(apps, schema_editor):
    job_model = apps.get_model('jobs', 'Job')
    history_model = apps.get_model('jobs', 'JobStatusHistory')
    for legacy_status in ('pending', 'rejected'):
        job_ids = list(job_model.objects.filter(status=legacy_status).values_list('pk', flat=True))
        if not job_ids:
            continue
        history_model.objects.bulk_create(
            [
                history_model(
                    job_id=job_id,
                    from_status=legacy_status,
                    to_status='draft',
                    actor_role='system',
                    note=CONVERSION_NOTE,
                )
                for job_id in job_ids
            ],
            batch_size=500,
        )
        job_model.objects.filter(pk__in=job_ids).update(
            status='draft',
            published_at=None,
            approved_at=None,
        )


class Migration(migrations.Migration):
    dependencies = [('jobs', '0045_candidate_hidden_job')]

    operations = [
        migrations.RunPython(convert_review_states_to_draft, migrations.RunPython.noop),
    ]
