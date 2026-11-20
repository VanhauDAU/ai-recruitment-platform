from django.db import migrations


def provider_to_network(apps, schema_editor):
    Connection = apps.get_model('campaigns', 'SocialAccountConnection')
    Connection.objects.filter(provider='fake').update(simulated=True)
    Connection.objects.update(network='facebook_page')


def network_to_provider(apps, schema_editor):
    Connection = apps.get_model('campaigns', 'SocialAccountConnection')
    Connection.objects.filter(simulated=True).update(provider='fake')
    Connection.objects.filter(simulated=False).update(provider='facebook')


class Migration(migrations.Migration):
    dependencies = [
        ('campaigns', '0004_social_networks'),
    ]

    operations = [
        migrations.RunPython(provider_to_network, network_to_provider),
    ]
