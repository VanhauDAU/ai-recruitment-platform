from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [('blog', '0002_admin_editorial_workflow')]

    operations = [
        migrations.AddField(
            model_name='tag',
            name='is_active',
            field=models.BooleanField(
                default=True,
                help_text='Ẩn thẻ khỏi phía ứng viên và form chọn thẻ',
            ),
        ),
    ]
