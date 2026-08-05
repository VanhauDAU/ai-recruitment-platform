import json
from io import StringIO

from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import TestCase

from apps.knowledgebase.models import KnowledgeArticle, KnowledgeCategory


class KnowledgebaseReadinessCommandTests(TestCase):
    def test_verified_seed_passes_machine_readable_readiness_gate(self):
        output = StringIO()

        call_command('check_knowledgebase_readiness', '--json', stdout=output)

        report = json.loads(output.getvalue())
        self.assertTrue(report['ready'])
        self.assertEqual(report['counts']['active_categories'], 7)
        self.assertGreaterEqual(report['counts']['public_articles'], 7)
        self.assertEqual(report['issues'], [])

    def test_missing_category_and_unknown_link_fail_closed(self):
        KnowledgeCategory.objects.filter(slug='lien-he-ho-tro').update(is_active=False)
        article = KnowledgeArticle.objects.get(slug='tao-chinh-sua-va-quan-ly-cv')
        revision = article.published_revision
        revision.body += '<p><a href="/duong-dan-khong-co">Sai</a></p>'
        revision.save(update_fields=['body', 'updated_at'])
        output = StringIO()

        with self.assertRaises(CommandError):
            call_command('check_knowledgebase_readiness', '--json', stdout=output)

        report = json.loads(output.getvalue())
        codes = {issue['code'] for issue in report['issues']}
        self.assertFalse(report['ready'])
        self.assertIn('required_category_inactive', codes)
        self.assertIn('unknown_internal_link', codes)
