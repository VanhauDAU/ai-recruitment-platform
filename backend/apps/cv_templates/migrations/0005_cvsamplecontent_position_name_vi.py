from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('cv_templates', '0004_cv_template_taxonomy_colors'),
    ]

    operations = [
        migrations.AddField(
            model_name='cvsamplecontent',
            name='position_name_vi',
            field=models.CharField(blank=True, max_length=255),
        ),
    ]
