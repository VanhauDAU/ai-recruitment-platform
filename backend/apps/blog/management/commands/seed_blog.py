from django.contrib.auth.models import Group, Permission
from django.contrib.contenttypes.models import ContentType
from django.core.management.base import BaseCommand

from apps.blog.models import PinnedPost, Post, PostCategory, Tag

# 6 danh mục ban đầu theo tài liệu mô tả (thứ tự trên thanh danh mục ngang).
CATEGORIES = [
    ('Định hướng nghề nghiệp', 'dinh-huong-nghe-nghiep'),
    ('Bí kíp tìm việc', 'bi-kip-tim-viec'),
    ('Chế độ lương thưởng', 'che-do-luong-thuong'),
    ('Kiến thức chuyên ngành', 'kien-thuc-chuyen-nganh'),
    ('Hành trang nghề nghiệp', 'hanh-trang-nghe-nghiep'),
    ('Thị trường và xu hướng tuyển dụng', 'thi-truong-xu-huong-tuyen-dung'),
]

# Quyền theo nhóm nhân viên.
EDITOR_CODENAMES = ['add_post', 'change_post', 'view_post', 'view_postcategory', 'view_tag']
MANAGER_CODENAMES = [
    'add_post',
    'change_post',
    'delete_post',
    'view_post',
    'add_postcategory',
    'change_postcategory',
    'delete_postcategory',
    'view_postcategory',
    'add_tag',
    'change_tag',
    'delete_tag',
    'view_tag',
    'add_pinnedpost',
    'change_pinnedpost',
    'delete_pinnedpost',
    'view_pinnedpost',
]


class Command(BaseCommand):
    help = 'Seed danh mục blog và nhóm quyền biên tập (cấu hình blog nằm ở seed_sitecontent).'

    def handle(self, *args, **options):
        for order, (name, slug) in enumerate(CATEGORIES, start=1):
            cat, created = PostCategory.objects.get_or_create(
                slug=slug,
                defaults={'name': name, 'order': order},
            )
            if not created and (cat.name != name or cat.order != order):
                cat.name, cat.order = name, order
                cat.save(update_fields=['name', 'order'])
            self.stdout.write(f'{"+ " if created else "= "}category {slug}')

        self._sync_group('blog_editor', EDITOR_CODENAMES)
        self._sync_group('blog_manager', MANAGER_CODENAMES)

        self.stdout.write(self.style.SUCCESS('Seed blog xong.'))

    def _sync_group(self, group_name, codenames):
        content_types = ContentType.objects.get_for_models(
            Post, PostCategory, Tag, PinnedPost
        ).values()
        perms = Permission.objects.filter(content_type__in=content_types, codename__in=codenames)
        found = set(perms.values_list('codename', flat=True))
        missing = set(codenames) - found
        group, created = Group.objects.get_or_create(name=group_name)
        group.permissions.set(perms)
        note = f' (thiếu: {", ".join(sorted(missing))})' if missing else ''
        self.stdout.write(
            f'{"+ " if created else "= "}group {group_name} ({len(found)} quyền){note}'
        )
