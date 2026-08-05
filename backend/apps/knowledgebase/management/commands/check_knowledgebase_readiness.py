import json
from collections import Counter
from html.parser import HTMLParser
from urllib.parse import urlsplit

from django.core.files.storage import default_storage
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from common.media_storage import media_storage_path
from common.metrics import record_metric

from ...models import (
    KnowledgeArticle,
    KnowledgeCategory,
    KnowledgeMediaAsset,
)
from ...selectors.public import PUBLIC_ARTICLE_FILTER

EXPECTED_CATEGORY_SLUGS = {
    'tai-khoan-va-dang-nhap',
    'bao-mat-va-quyen-rieng',
    'tim-viec-va-goi-y-viec-lam',
    'ung-tuyen-va-theo-doi-ho-so',
    'cv-va-mau-cv',
    'tim-viec-an-toan',
    'lien-he-ho-tro',
}

# Registry nhỏ này là contract của các route frontend được phép xuất hiện trong
# nội dung. Prefix động vẫn phải bắt đầu từ một route canonical đã biết.
KNOWN_INTERNAL_PATHS = {
    '/forgot-password',
    '/login',
    '/mau-cv',
    '/sign-up',
    '/tai-khoan/cai-dat-goi-y-viec-lam',
    '/tai-khoan/cv-cua-toi',
    '/tai-khoan/doi-mat-khau',
    '/tai-khoan/viec-lam-da-ung-tuyen',
    '/tai-khoan/viec-lam-phu-hop',
    '/tai-khoan/xac-minh-hai-buoc',
    '/tai-khoan/xac-thuc-email',
    '/tro-giup',
    '/viec-lam',
    '/viec-lam-da-luu',
}
KNOWN_INTERNAL_PREFIXES = (
    '/mau-cv/',
    '/tro-giup/',
    '/viec-lam/',
)


class _ContentReferenceParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.links = []
        self.images = []

    def handle_starttag(self, tag, attrs):
        values = dict(attrs)
        if tag.lower() == 'a' and values.get('href'):
            self.links.append(values['href'])
        if tag.lower() == 'img':
            self.images.append(values)


def _issue(issues, code, resource, detail):
    issues.append({'code': code, 'resource': resource, 'detail': detail})


def _check_link(issues, article, link):
    parsed = urlsplit(link)
    if parsed.scheme:
        if parsed.scheme not in {'https', 'mailto', 'tel'}:
            _issue(issues, 'unsafe_external_link', article.public_id, parsed.scheme)
        return
    path = parsed.path.rstrip('/') or '/'
    if path not in KNOWN_INTERNAL_PATHS and not path.startswith(KNOWN_INTERNAL_PREFIXES):
        _issue(issues, 'unknown_internal_link', article.public_id, path[:160])


def build_readiness_report():
    now = timezone.now()
    issues = []
    active_categories = list(KnowledgeCategory.objects.filter(is_active=True))
    active_slugs = {category.slug for category in active_categories}
    for slug in sorted(EXPECTED_CATEGORY_SLUGS - active_slugs):
        _issue(issues, 'required_category_inactive', slug, 'Category bắt buộc chưa active.')

    public_articles = list(
        KnowledgeArticle.objects.filter(PUBLIC_ARTICLE_FILTER)
        .select_related('category', 'published_revision')
        .order_by('category__order', 'order', 'public_id')
    )
    public_by_category = Counter(article.category_id for article in public_articles)
    for category in active_categories:
        if public_by_category[category.id] == 0:
            _issue(
                issues,
                'category_without_public_article',
                category.public_id,
                category.slug,
            )

    title_keys = Counter(
        (article.category_id, article.published_revision.title.casefold())
        for article in public_articles
    )
    media_issues = 0
    image_references = []
    for article in public_articles:
        revision = article.published_revision
        if title_keys[(article.category_id, revision.title.casefold())] > 1:
            _issue(issues, 'duplicate_title', article.public_id, article.category.slug)
        if not revision.source_reference.strip():
            _issue(issues, 'missing_source_reference', article.public_id, article.category.slug)
        if not revision.seo_description.strip():
            _issue(issues, 'missing_seo_description', article.public_id, article.category.slug)
        if article.review_due_at and article.review_due_at <= now:
            _issue(issues, 'review_overdue', article.public_id, article.category.slug)
        if article.category.slug == 'tim-viec-an-toan' and not revision.reviewed_at:
            _issue(issues, 'safety_content_not_reviewed', article.public_id, article.category.slug)

        parser = _ContentReferenceParser()
        parser.feed(revision.body)
        parser.close()
        for link in parser.links:
            _check_link(issues, article, link)
        for image in parser.images:
            storage_key = media_storage_path(image.get('src'))
            has_alt = image.get('data-decorative') == 'true' or bool(
                str(image.get('alt') or '').strip()
            )
            image_references.append((article, storage_key, has_alt))

    referenced_keys = {key for _, key, _ in image_references if key}
    registered_keys = set(
        KnowledgeMediaAsset.objects.filter(storage_key__in=referenced_keys).values_list(
            'storage_key', flat=True
        )
    )
    available_keys = {key for key in registered_keys if default_storage.exists(key)}
    for article, storage_key, has_alt in image_references:
        asset_exists = storage_key in available_keys
        if not has_alt or not asset_exists:
            media_issues += 1
            _issue(
                issues,
                'invalid_media_reference',
                article.public_id,
                'missing_alt' if not has_alt else 'missing_asset',
            )

    counts = {
        'active_categories': len(active_categories),
        'public_articles': len(public_articles),
        'archived_articles': KnowledgeArticle.objects.filter(
            lifecycle_state=KnowledgeArticle.LifecycleState.ARCHIVED
        ).count(),
        'overdue_articles': KnowledgeArticle.objects.filter(
            lifecycle_state=KnowledgeArticle.LifecycleState.ACTIVE,
            review_due_at__lte=now,
        ).count(),
        'media_issues': media_issues,
    }
    for state, value in counts.items():
        record_metric('knowledgebase_content_state', value, state=state)
    return {'ready': not issues, 'counts': counts, 'issues': issues}


class Command(BaseCommand):
    help = 'Kiểm tra content/SEO readiness trước khi bật index Help Center.'

    def add_arguments(self, parser):
        parser.add_argument('--json', action='store_true', dest='as_json')

    def handle(self, *args, **options):
        report = build_readiness_report()
        if options['as_json']:
            self.stdout.write(json.dumps(report, ensure_ascii=False, sort_keys=True))
        elif report['ready']:
            self.stdout.write(
                self.style.SUCCESS(
                    'Knowledgebase ready: '
                    f'{report["counts"]["active_categories"]} category, '
                    f'{report["counts"]["public_articles"]} bài public.'
                )
            )
        else:
            for issue in report['issues']:
                self.stderr.write(f'[{issue["code"]}] {issue["resource"]}: {issue["detail"]}')
        if not report['ready']:
            raise CommandError(f'Knowledgebase chưa sẵn sàng: {len(report["issues"])} lỗi.')
