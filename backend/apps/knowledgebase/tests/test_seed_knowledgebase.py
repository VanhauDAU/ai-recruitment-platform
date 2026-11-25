from io import StringIO

from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import TestCase

from apps.accounts.models import User

from ..models import KnowledgeArticle, KnowledgeArticleRevision, KnowledgeCategory
from ..seed_data.catalog import ARTICLES, CATEGORIES
from ..selectors.public import public_articles_queryset, public_categories_queryset

KEYS = {(item['category'], item['slug']) for item in ARTICLES}


def seed(**options):
    call_command('seed_knowledgebase', stdout=StringIO(), **options)


def seeded_public():
    return [
        article
        for article in public_articles_queryset()
        if (article.category.slug, article.slug) in KEYS
    ]


class SeedKnowledgebaseTests(TestCase):
    def test_requires_existing_admin(self):
        with self.assertRaisesMessage(CommandError, 'createsuperuser'):
            seed()
        self.assertFalse(KnowledgeCategory.objects.filter(slug=CATEGORIES[0]['slug']).exists())

    def test_is_idempotent_and_publishes_every_article(self):
        User.objects.create_superuser(email='kb-seed@example.com', password='Password@123')

        seed()
        seed()

        self.assertEqual(len(seeded_public()), len(ARTICLES))
        self.assertEqual(
            KnowledgeArticleRevision.objects.filter(
                article__slug__in={slug for _, slug in KEYS}
            ).count(),
            len(ARTICLES),
        )
        public_slugs = {category.slug for category in public_categories_queryset()}
        self.assertTrue({item['slug'] for item in CATEGORIES} <= public_slugs)

    def test_update_flag_publishes_new_revision_only_on_request(self):
        User.objects.create_superuser(email='kb-seed@example.com', password='Password@123')
        seed()
        item = ARTICLES[0]
        article = KnowledgeArticle.objects.get(category__slug=item['category'], slug=item['slug'])
        KnowledgeArticleRevision.objects.filter(pk=article.published_revision_id).update(
            content_hash='stale'
        )

        seed()
        self.assertEqual(article.revisions.count(), 1)

        seed(update=True)
        article.refresh_from_db()
        self.assertEqual(article.revisions.count(), 2)
        self.assertEqual(article.published_revision.number, 2)
        self.assertEqual(len(seeded_public()), len(ARTICLES))
