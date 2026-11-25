from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from apps.blog.models import PinnedPost, Post, PostCategory, Tag
from apps.blog.seed_data.catalog import PINNED_SLUGS, POSTS, TAGS
from apps.blog.services import create_post, publish_post, sanitize_blog_html, save_post_draft
from apps.jobs.models import JobCategory

EDITABLE = ('title', 'category', 'summary', 'content', 'related_job_category')
SEO = ('seo_title', 'seo_description')


def resolve_author(email=None):
    """Nhân viên đứng tên bài; lệnh không tự tạo tài khoản."""
    users = get_user_model().objects.filter(is_active=True, is_staff=True)
    if email:
        author = users.filter(email__iexact=email).order_by('-is_superuser', 'id').first()
        if not author:
            raise CommandError(f'Không tìm thấy tài khoản quản trị đang hoạt động: {email}')
        return author
    author = users.order_by('-is_superuser', 'id').first()
    if not author:
        raise CommandError(
            'Chưa có tài khoản quản trị (is_staff). Tạo admin trước, ví dụ: '
            'python manage.py createsuperuser, rồi chạy lại lệnh.'
        )
    return author


class Command(BaseCommand):
    help = 'Seed bài viết cẩm nang nghề nghiệp mẫu (idempotent theo slug). Chạy seed_blog trước.'

    def add_arguments(self, parser):
        parser.add_argument('--author-email', help='Email tài khoản quản trị đứng tên bài')
        parser.add_argument(
            '--update',
            action='store_true',
            help='Đồng bộ lại nội dung bài đã có theo dữ liệu mẫu (mặc định giữ nguyên bản admin đã sửa)',
        )

    @transaction.atomic
    def handle(self, *args, **options):
        author = resolve_author(options.get('author_email'))
        categories = {c.slug: c for c in PostCategory.objects.all()}
        missing = {p['category'] for p in POSTS} - categories.keys()
        if missing:
            raise CommandError(
                f'Thiếu danh mục {", ".join(sorted(missing))}. Chạy python manage.py seed_blog trước.'
            )
        tags = self._sync_tags()
        job_categories = {
            c.slug: c
            for c in JobCategory.objects.filter(
                slug__in={p['job_category'] for p in POSTS if p.get('job_category')}
            )
        }
        now = timezone.now()
        stats = {'created': 0, 'updated': 0, 'unchanged': 0, 'skipped': 0}
        for item in POSTS:
            data = {
                'title': item['title'],
                'category': categories[item['category']],
                'summary': item['summary'],
                'content': sanitize_blog_html(item['content']),
                'related_job_category': job_categories.get(item.get('job_category')),
                'seo_title': item['seo_title'],
                'seo_description': item['seo_description'],
            }
            post_tags = [tags[slug] for slug in item['tags']]
            result = self._upsert(
                item['slug'], data, post_tags, author, now, item['days_ago'], options['update']
            )
            stats[result] += 1
            self.stdout.write(f'{result[0]} {item["slug"]}')
        pins = self._sync_pins()
        self.stdout.write(
            self.style.SUCCESS(
                'Seed bài viết xong: {created} tạo mới, {updated} cập nhật, {unchanged} giữ nguyên, '
                '{skipped} bỏ qua (đã gỡ); '.format(**stats)
                + f'{len(tags)} thẻ, {pins} bài ghim.'
            )
        )

    def _sync_tags(self):
        tags = {}
        for slug, name in TAGS.items():
            tag, _ = Tag.objects.get_or_create(slug=slug, defaults={'name': name})
            tags[slug] = tag
        return tags

    def _upsert(self, slug, data, tags, author, now, days_ago, update):
        post = Post.objects.filter(slug=slug).first()
        if post is None:
            post = create_post(
                actor=author,
                validated_data={
                    **data,
                    'slug': slug,
                    'published_at': now - timedelta(days=days_ago),
                },
                tags=tags,
            )
            publish_post(post=post, actor=author)
            return 'created'
        if post.status == Post.Status.ARCHIVED:
            # Quản trị viên đã gỡ bài: tôn trọng quyết định đó.
            return 'skipped'
        if not update and post.status == Post.Status.PUBLISHED:
            return 'unchanged'
        changes = {f: v for f, v in data.items() if getattr(post, f) != v}
        tags_changed = {t.pk for t in post.tags.all()} != {t.pk for t in tags}
        if post.status == Post.Status.PUBLISHED and not changes and not tags_changed:
            return 'unchanged'
        # Sửa qua luồng biên tập như admin: nháp (hoặc bản sửa nháp) rồi xuất bản.
        if changes or tags_changed:
            base = post.working_copy.edit_revision if hasattr(post, 'working_copy') else None
            save_post_draft(
                post=post,
                actor=author,
                validated_data={f: data[f] for f in (*EDITABLE, *SEO)},
                tags=tags,
                base_revision=base or post.edit_revision,
            )
        publish_post(post=post, actor=author)
        return 'updated'

    def _sync_pins(self):
        posts = {p.slug: p for p in Post.objects.filter(slug__in=PINNED_SLUGS)}
        count = 0
        for order, slug in enumerate(PINNED_SLUGS, start=1):
            if slug not in posts:
                continue
            PinnedPost.objects.get_or_create(
                placement=PinnedPost.Placement.SUPPORT_DOCS,
                post=posts[slug],
                defaults={'order': order},
            )
            count += 1
        return count
