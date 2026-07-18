from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('employers', '0010_recruitmentneed'),
    ]

    operations = [
        migrations.AlterField(
            model_name='recruiterprofile',
            name='contact_phone',
            field=models.CharField(
                blank=True,
                help_text='Số điện thoại cá nhân khai báo khi đăng ký; xác thực riêng qua OTP.',
                max_length=20,
                null=True,
            ),
        ),
    ]
