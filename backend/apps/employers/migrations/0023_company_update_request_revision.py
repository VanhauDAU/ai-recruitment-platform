from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('employers', '0022_employer_verification_notification'),
    ]

    operations = [
        migrations.AddField(
            model_name='companyupdaterequest',
            name='lock_version',
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.AddField(
            model_name='companyupdaterequest',
            name='revision',
            field=models.PositiveIntegerField(default=1),
        ),
    ]
