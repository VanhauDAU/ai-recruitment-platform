from django.db import migrations


def forwards(apps, schema_editor):
    """Điền jobs.company qua RecruiterProfile của người đăng tin.

    Migration employers.0007 tạo recruiter_profile (kèm company) cho MỌI
    employer_profile, kể cả profile bị gộp theo tax_code — map qua user
    nên không lệ thuộc việc public_id của profile bị gộp không còn company.
    """
    Job = apps.get_model('jobs', 'Job')
    RecruiterProfile = apps.get_model('employers', 'RecruiterProfile')

    company_by_user = dict(RecruiterProfile.objects.values_list('user_id', 'company_id'))
    for job in Job.objects.filter(company__isnull=True):
        job.company_id = company_by_user[job.employer_id]
        job.save(update_fields=['company_id'])


def backwards(apps, schema_editor):
    apps.get_model('jobs', 'Job').objects.update(company=None)


class Migration(migrations.Migration):
    dependencies = [
        ('jobs', '0014_job_company'),
        ('employers', '0007_migrate_employer_profiles_to_companies'),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
    ]
