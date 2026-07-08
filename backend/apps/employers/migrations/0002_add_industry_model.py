from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('employers', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='Industry',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=255, unique=True)),
                ('slug', models.SlugField(blank=True, max_length=255, unique=True)),
            ],
            options={
                'verbose_name_plural': 'industries',
                'ordering': ['name'],
            },
        ),
        migrations.AddField(
            model_name='employerprofile',
            name='industries',
            field=models.ManyToManyField(blank=True, related_name='employers', to='employers.industry'),
        ),
    ]
