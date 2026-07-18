from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ('employers', '0008_delete_employerprofile'),
        ('locations', '0002_location_merged_from'),
    ]

    operations = [
        migrations.AddField(
            model_name='recruiterprofile',
            name='contact_phone',
            field=models.CharField(
                blank=True,
                help_text='Số điện thoại cá nhân khai báo khi đăng ký; xác thực riêng qua OTP.',
                max_length=20,
                null=True,
                unique=True,
            ),
        ),
        migrations.AddField(
            model_name='recruiterprofile',
            name='gender',
            field=models.CharField(
                blank=True,
                choices=[('male', 'Nam'), ('female', 'Nữ'), ('other', 'Khác')],
                max_length=10,
            ),
        ),
        migrations.AddField(
            model_name='recruiterprofile',
            name='marketing_decided_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='recruiterprofile',
            name='marketing_opt_in',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='recruiterprofile',
            name='registration_completed_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='recruiterprofile',
            name='terms_accepted_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='recruiterprofile',
            name='terms_policy_version',
            field=models.CharField(blank=True, max_length=30),
        ),
        migrations.AddField(
            model_name='recruiterprofile',
            name='work_location',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name='+',
                to='locations.location',
            ),
        ),
    ]
