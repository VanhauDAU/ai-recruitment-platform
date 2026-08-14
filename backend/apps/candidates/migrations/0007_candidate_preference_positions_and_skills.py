import django.db.models.deletion
from django.db import migrations, models


def backfill_custom_positions(apps, schema_editor):
    CandidateJobPreference = apps.get_model('candidates', 'CandidateJobPreference')
    CandidateDesiredPositionOther = apps.get_model(
        'candidates',
        'CandidateDesiredPositionOther',
    )

    rows = []
    normalized_preferences = []
    for preference in CandidateJobPreference.objects.filter(
        desired_position_other__isnull=False
    ).iterator():
        name = preference.desired_position_other.strip()
        if not name:
            preference.desired_position_other = None
            normalized_preferences.append(preference)
            continue
        rows.append(
            CandidateDesiredPositionOther(
                job_preference_id=preference.pk,
                name=name,
                sort_order=0,
            )
        )
        if name != preference.desired_position_other:
            preference.desired_position_other = name
            normalized_preferences.append(preference)

    CandidateDesiredPositionOther.objects.bulk_create(rows)
    if normalized_preferences:
        CandidateJobPreference.objects.bulk_update(
            normalized_preferences,
            ['desired_position_other'],
        )


class Migration(migrations.Migration):
    dependencies = [
        ('candidates', '0006_opt_in_suitable_job_recommendations'),
        ('skills', '0002_alter_skill_options_remove_skill_category_skillgroup_and_more'),
    ]

    operations = [
        migrations.CreateModel(
            name='CandidateDesiredPositionOther',
            fields=[
                (
                    'id',
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name='ID',
                    ),
                ),
                ('name', models.CharField(max_length=255)),
                ('sort_order', models.PositiveSmallIntegerField(default=0)),
                (
                    'job_preference',
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name='desired_position_others',
                        to='candidates.candidatejobpreference',
                    ),
                ),
            ],
            options={
                'db_table': 'candidate_desired_position_others',
                'ordering': ['sort_order', 'id'],
                'constraints': [
                    models.UniqueConstraint(
                        fields=('job_preference', 'name'),
                        name='candidate_pref_position_other_unique',
                    ),
                ],
            },
        ),
        migrations.CreateModel(
            name='CandidatePreferredSkill',
            fields=[
                (
                    'id',
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name='ID',
                    ),
                ),
                ('sort_order', models.PositiveSmallIntegerField(default=0)),
                (
                    'job_preference',
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name='preferred_skills',
                        to='candidates.candidatejobpreference',
                    ),
                ),
                (
                    'skill',
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name='preferred_by_candidates',
                        to='skills.skill',
                    ),
                ),
            ],
            options={
                'db_table': 'candidate_preferred_skills',
                'ordering': ['sort_order', 'id'],
                'constraints': [
                    models.UniqueConstraint(
                        fields=('job_preference', 'skill'),
                        name='candidate_pref_skill_unique',
                    ),
                ],
            },
        ),
        migrations.RunPython(backfill_custom_positions, migrations.RunPython.noop),
    ]
