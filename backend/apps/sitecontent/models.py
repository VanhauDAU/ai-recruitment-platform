import re

from django.db import models

# Bỏ tiền tố đơn vị hành chính để nhãn gọn: "Thành phố Cần Thơ" -> "Cần Thơ".
_PROVINCE_PREFIX = re.compile(r'^(Thành phố|Tỉnh)\s+', re.IGNORECASE)


class SiteSetting(models.Model):
    """Kho cấu hình key-value cho toàn dự án (giá trị JSON).

    Nền tảng cho mọi cấu hình admin chỉnh được mà không cần deploy: thông tin
    liên hệ, feature flag, màu sắc/giao diện, SEO... Giá trị là JSON nên chứa
    được cả chuỗi, số, danh sách hay object tuỳ `key`.
    """

    class Group(models.TextChoices):
        GENERAL = 'general', 'Chung'
        CONTACT = 'contact', 'Liên hệ'
        APPEARANCE = 'appearance', 'Giao diện'
        SEO = 'seo', 'SEO'

    key = models.SlugField(max_length=100, unique=True, help_text='Định danh dùng ở code/frontend, vd: site_name')
    label = models.CharField(max_length=200, help_text='Tên hiển thị trong trang quản trị')
    group = models.CharField(max_length=30, choices=Group.choices, default=Group.GENERAL)
    value = models.JSONField(default=dict, blank=True)
    description = models.CharField(max_length=300, blank=True)
    is_public = models.BooleanField(default=True, help_text='Cho phép trả về qua API công khai')
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['group', 'key']
        verbose_name = 'Cấu hình site'
        verbose_name_plural = 'Cấu hình site'

    def __str__(self):
        return self.key


class LinkGroup(models.Model):
    """Một cụm link có thứ tự, bật/tắt được (vd: cụm link SEO trên footer).

    `source` quyết định nội dung: nhập tay (`manual`) hay tự sinh từ bảng khác
    (`locations`, `categories`) để nhãn luôn khớp dữ liệu thật mà không phải
    nhập lại. Là "section" mẫu — section khác về sau theo cùng khuôn.
    """

    class Source(models.TextChoices):
        MANUAL = 'manual', 'Nhập tay'
        LOCATIONS = 'locations', 'Tự sinh từ Khu vực'
        CATEGORIES = 'categories', 'Tự sinh từ Ngành nghề'

    class Placement(models.TextChoices):
        FOOTER_SEO = 'footer_seo', 'Cụm link SEO (trên footer)'

    key = models.SlugField(max_length=100, unique=True)
    title = models.CharField(max_length=200)
    placement = models.CharField(max_length=30, choices=Placement.choices, default=Placement.FOOTER_SEO)
    source = models.CharField(max_length=20, choices=Source.choices, default=Source.MANUAL)
    limit = models.PositiveSmallIntegerField(default=16, help_text='Số link tối đa khi tự sinh từ DB')
    order = models.PositiveSmallIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['placement', 'order']
        verbose_name = 'Cụm link'
        verbose_name_plural = 'Cụm link'

    def __str__(self):
        return self.title

    def resolve_items(self):
        """Trả về [{label, url}] đã sẵn sàng cho frontend, tuỳ theo `source`."""
        if self.source == self.Source.LOCATIONS:
            from apps.locations.models import Location

            provinces = Location.objects.filter(level=Location.Level.PROVINCE, is_active=True).order_by('name')[: self.limit]
            return [
                {'label': f'Việc làm {_PROVINCE_PREFIX.sub("", p.name)}', 'url': f'/viec-lam?locations={p.id}'}
                for p in provinces
            ]
        if self.source == self.Source.CATEGORIES:
            from apps.jobs.models import JobCategory

            categories = JobCategory.objects.filter(status=JobCategory.Status.ACTIVE).order_by('name')[: self.limit]
            return [{'label': f'Việc làm {c.name}', 'url': f'/viec-lam?category={c.id}'} for c in categories]
        return [{'label': i.label, 'url': i.url} for i in self.items.filter(is_active=True)]


class LinkItem(models.Model):
    """Link nhập tay thuộc một cụm `manual` (bỏ qua khi cụm tự sinh từ DB)."""

    group = models.ForeignKey(LinkGroup, on_delete=models.CASCADE, related_name='items')
    label = models.CharField(max_length=200)
    url = models.CharField(max_length=500, blank=True, help_text='Để trống nếu tính năng chưa có (hiển thị "Sắp ra mắt")')
    order = models.PositiveSmallIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['order']

    def __str__(self):
        return self.label


class Banner(models.Model):
    """Một slide banner (vd: carousel đầu trang chủ), nội dung nhập qua admin.

    Chưa có kho ảnh nên nền dùng gradient theo `theme` (đủ 3 tông đang có sẵn
    trên giao diện); khi có ảnh thật, `image_url` sẽ được ưu tiên hơn theme.
    `placement` để tái dùng model này cho carousel ở trang khác sau này.
    """

    class Theme(models.TextChoices):
        GREEN = 'green', 'Xanh lá (thương hiệu)'
        BLUE = 'blue', 'Xanh dương'
        ORANGE = 'orange', 'Cam - hồng'

    class Placement(models.TextChoices):
        HOME_HERO = 'home_hero', 'Carousel trang chủ'

    placement = models.CharField(max_length=30, choices=Placement.choices, default=Placement.HOME_HERO)
    eyebrow = models.CharField(max_length=100, blank=True, help_text='Nhãn nhỏ phía trên tiêu đề, vd: TUYỂN DỤNG GẤP')
    title = models.CharField(max_length=200)
    subtitle = models.CharField(max_length=300, blank=True)
    image_url = models.TextField(blank=True, help_text='Để trống để dùng nền gradient theo Theme bên dưới')
    theme = models.CharField(max_length=20, choices=Theme.choices, default=Theme.GREEN)
    cta_label = models.CharField(max_length=100, blank=True, help_text='Để trống nếu banner không có nút bấm')
    cta_url = models.CharField(max_length=300, blank=True)
    order = models.PositiveSmallIntegerField(default=0)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['placement', 'order']
        verbose_name = 'Banner'
        verbose_name_plural = 'Banner'

    def __str__(self):
        return self.title
