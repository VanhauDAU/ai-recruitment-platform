from django.contrib.auth.models import Group, Permission
from django.contrib.contenttypes.models import ContentType
from django.core.management.base import BaseCommand

from apps.blog.models import PinnedPost, Post, PostCategory, Tag
from apps.sitecontent.models import SiteSetting

# 6 danh mục ban đầu theo tài liệu mô tả (thứ tự trên thanh danh mục ngang).
CATEGORIES = [
    ('Định hướng nghề nghiệp', 'dinh-huong-nghe-nghiep'),
    ('Bí kíp tìm việc', 'bi-kip-tim-viec'),
    ('Chế độ lương thưởng', 'che-do-luong-thuong'),
    ('Kiến thức chuyên ngành', 'kien-thuc-chuyen-nganh'),
    ('Hành trang nghề nghiệp', 'hanh-trang-nghe-nghiep'),
    ('Thị trường và xu hướng tuyển dụng', 'thi-truong-xu-huong-tuyen-dung'),
]

# Cấu hình chữ cho khối/trang blog (admin đổi được, không cần deploy).
G = SiteSetting.Group
T = SiteSetting.ValueType
# (key, label, value_type, default, is_public, description)
SETTINGS = [
    (
        'blog_page_title',
        'Tiêu đề trang Cẩm nang',
        T.TEXT,
        'Cẩm nang nghề nghiệp',
        True,
        'Tiêu đề hiển thị ở đầu trang /blog và title tag.',
    ),
    (
        'blog_meta_description',
        'Mô tả SEO trang Cẩm nang',
        T.TEXTAREA,
        'Cẩm nang nghề nghiệp: định hướng, bí kíp tìm việc, lương thưởng và kiến thức chuyên ngành.',
        True,
        'Meta description mặc định cho trang danh sách blog.',
    ),
    (
        'blog_support_docs_title',
        'Tiêu đề khối Tài liệu hỗ trợ',
        T.TEXT,
        'Tài liệu hỗ trợ tìm việc',
        True,
        'Tiêu đề khối bài viết ghim ở sidebar trang chi tiết.',
    ),
    (
        'blog_benefits',
        'Khối lợi ích (trang chi tiết bài viết)',
        T.JSON,
        {
            'items': [
                {
                    'title': 'Kết nối nhanh với nhà tuyển dụng',
                    'description': 'Hồ sơ của bạn được gợi ý tới nhà tuyển dụng phù hợp ngay khi ứng tuyển.',
                },
                {
                    'title': 'Tạo CV chuyên nghiệp miễn phí',
                    'description': 'Kho mẫu CV chuẩn theo từng ngành nghề, tùy chỉnh dễ dàng trong vài phút.',
                },
                {
                    'title': 'Việc làm chất lượng được xác thực',
                    'description': 'Tin tuyển dụng từ công ty đã xác thực, đầy đủ mức lương và phúc lợi.',
                },
            ],
            'cta_label': 'Tạo CV ngay',
            'cta_url': '/',
        },
        True,
        'Khối "Lợi ích khi sử dụng <tên site>" đầu trang chi tiết bài viết: items [{title, description}] + nút CTA.',
    ),
]

# Quyền theo nhóm nhân viên.
EDITOR_CODENAMES = ['add_post', 'change_post', 'view_post', 'view_postcategory', 'view_tag']
MANAGER_CODENAMES = [
    'add_post',
    'change_post',
    'delete_post',
    'view_post',
    'can_publish_post',
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
    help = 'Seed danh mục blog, cấu hình site nhóm blog và nhóm quyền biên tập.'

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

        for key, label, value_type, default, is_public, description in SETTINGS:
            metadata = {
                'label': label,
                'group': G.BLOG,
                'value_type': value_type,
                'is_public': is_public,
                'description': description,
            }
            setting, created = SiteSetting.objects.get_or_create(
                key=key, defaults={**metadata, 'value': default}
            )
            if not created:
                changed = [f for f, v in metadata.items() if getattr(setting, f) != v]
                for f in changed:
                    setattr(setting, f, metadata[f])
                if changed:
                    setting.save()
            self.stdout.write(f'{"+ " if created else "= "}setting {key}')

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
