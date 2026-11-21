from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone
from django.utils.translation import gettext_lazy as _


class SiteSetting(models.Model):
    """Kho cấu hình key-value cho toàn dự án (giá trị JSON).

    Chỉ chứa cấu hình vận hành admin chỉnh được mà không cần deploy. Mọi key
    phải có code đọc thật (xem ADR-0026 và test hợp đồng). Secret và giới hạn
    bảo mật/hạ tầng nằm ở ``.env``; trang quản trị chỉ hiển thị chúng ở dạng
    chỉ đọc. Metadata mỗi key (nhãn, nhóm, mặc định...) do
    ``seed_data/settings.json`` quản lý.
    """

    class Group(models.TextChoices):
        # Giao diện & nội dung
        BRAND = 'brand', 'Thương hiệu'
        HOMEPAGE = 'homepage', 'Trang chủ & điều hướng'
        SEO = 'seo', 'SEO & chia sẻ'
        CONTACT = 'contact', 'Liên hệ & mạng xã hội'
        FOOTER = 'footer', 'Chân trang'
        BLOG = 'blog', 'Cẩm nang'
        # Nghiệp vụ tuyển dụng
        ACCOUNTS = 'accounts', 'Tài khoản & đăng nhập'
        EMPLOYER = 'employer', 'Nhà tuyển dụng & xác thực'
        JOBS = 'jobs', 'Tin tuyển dụng'
        APPLICATIONS = 'applications', 'Ứng tuyển & SLA'
        CV = 'cv', 'Hồ sơ & CV'
        EMAIL = 'email', 'Email & thông báo'
        AI = 'ai', 'AI'
        # Tuân thủ & vận hành
        LEGAL = 'legal', 'Pháp lý & đồng ý'
        RETENTION = 'retention', 'Lưu trữ dữ liệu'
        FEATURES = 'features', 'Tính năng'
        OPERATIONS = 'operations', 'Vận hành'

    class Area(models.TextChoices):
        """Khu trên thanh bên trang cấu hình; mỗi nhóm thuộc đúng một khu."""

        CONTENT = 'content', 'Giao diện & nội dung'
        RECRUITING = 'recruiting', 'Nghiệp vụ tuyển dụng'
        COMPLIANCE = 'compliance', 'Tuân thủ & vận hành'

    GROUP_AREAS = {
        Group.BRAND: Area.CONTENT,
        Group.HOMEPAGE: Area.CONTENT,
        Group.SEO: Area.CONTENT,
        Group.CONTACT: Area.CONTENT,
        Group.FOOTER: Area.CONTENT,
        Group.BLOG: Area.CONTENT,
        Group.ACCOUNTS: Area.RECRUITING,
        Group.EMPLOYER: Area.RECRUITING,
        Group.JOBS: Area.RECRUITING,
        Group.APPLICATIONS: Area.RECRUITING,
        Group.CV: Area.RECRUITING,
        Group.EMAIL: Area.RECRUITING,
        Group.AI: Area.RECRUITING,
        Group.LEGAL: Area.COMPLIANCE,
        Group.RETENTION: Area.COMPLIANCE,
        Group.FEATURES: Area.COMPLIANCE,
        Group.OPERATIONS: Area.COMPLIANCE,
    }

    class ValueType(models.TextChoices):
        TEXT = 'text', 'Chuỗi ngắn'
        TEXTAREA = 'textarea', 'Đoạn văn'
        NUMBER = 'number', 'Số'
        BOOLEAN = 'boolean', 'Bật/tắt'
        SELECT = 'select', 'Chọn một'
        MULTISELECT = 'multiselect', 'Chọn nhiều'
        COLOR = 'color', 'Màu'
        IMAGE = 'image', 'Ảnh'
        EMAIL = 'email', 'Email'
        URL = 'url', 'URL'
        JSON = 'json', 'JSON'

    key = models.SlugField(
        max_length=100, unique=True, help_text='Định danh dùng ở code/frontend, vd: site_name'
    )
    label = models.CharField(max_length=200, help_text='Tên hiển thị trong trang quản trị')
    group = models.CharField(max_length=30, choices=Group.choices, default=Group.BRAND)
    section = models.CharField(
        max_length=100, blank=True, help_text='Tiêu đề khối con trong nhóm, vd: Logo & biểu tượng'
    )
    value = models.JSONField(default=dict, blank=True)
    value_type = models.CharField(
        max_length=20,
        choices=ValueType.choices,
        default=ValueType.TEXT,
        help_text='Kiểu dữ liệu để trang quản trị tự render form phù hợp',
    )
    options = models.JSONField(
        default=dict,
        blank=True,
        help_text=(
            'number: min/max/integer/step; select: choices; json: schema; '
            'chung: applies_to, depends_on, risky, max_length'
        ),
    )
    order = models.PositiveSmallIntegerField(default=0, help_text='Thứ tự hiển thị trong nhóm')
    description = models.CharField(max_length=300, blank=True)
    help = models.TextField(
        blank=True, help_text='Giải thích chi tiết hiện trong nút "?" của trang quản trị'
    )
    is_public = models.BooleanField(default=True, help_text='Cho phép trả về qua API công khai')
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['group', 'order', 'key']
        verbose_name = 'Cấu hình site'
        verbose_name_plural = 'Cấu hình site'

    def __str__(self):
        return self.key

    # Lựa chọn lấy từ cấu hình máy chủ thay vì seed, để admin không chọn được
    # giá trị máy chủ không cho phép (key -> tên biến Django settings).
    SERVER_CHOICES = {'ai_job_generation_model': 'AI_JOB_GENERATION_MODEL_ALLOWLIST'}

    def resolved_options(self):
        """``options`` kèm ``choices`` lấy từ máy chủ cho key trong ``SERVER_CHOICES``."""
        options = dict(self.options) if isinstance(self.options, dict) else {}
        setting_name = self.SERVER_CHOICES.get(self.key)
        if setting_name:
            options['choices'] = [
                {'value': value, 'label': value} for value in getattr(settings, setting_name, ())
            ]
        return options


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
        FOOTER_NAV = 'footer_nav', 'Menu điều hướng footer'

    key = models.SlugField(max_length=100, unique=True)
    title = models.CharField(max_length=200)
    placement = models.CharField(
        max_length=30, choices=Placement.choices, default=Placement.FOOTER_SEO
    )
    source = models.CharField(max_length=20, choices=Source.choices, default=Source.MANUAL)
    limit = models.PositiveSmallIntegerField(
        default=16, help_text='Số link tối đa khi tự sinh từ DB'
    )
    order = models.PositiveSmallIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['placement', 'order']
        verbose_name = 'Cụm link'
        verbose_name_plural = 'Cụm link'

    def __str__(self):
        return self.title


class LinkItem(models.Model):
    """Link nhập tay thuộc một cụm `manual` (bỏ qua khi cụm tự sinh từ DB)."""

    group = models.ForeignKey(LinkGroup, on_delete=models.CASCADE, related_name='items')
    label = models.CharField(max_length=200)
    url = models.CharField(
        max_length=500,
        blank=True,
        help_text='Để trống nếu tính năng chưa có (hiển thị "Sắp ra mắt")',
    )
    order = models.PositiveSmallIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['order']

    def __str__(self):
        return self.label


class Banner(models.Model):
    """Một slide banner (vd: carousel đầu trang chủ), nội dung nhập qua admin.

    ``kind`` quyết định cách dựng slide:

    - ``image``: cả slide là ảnh đã thiết kế sẵn (nút nằm trong ảnh), bấm vào
      đâu cũng mở ``cta_url``; ``title`` chỉ là tên nội bộ dùng làm alt/tooltip.
    - ``promo``: bố cục chữ + ảnh minh họa tùy chọn trên nền gradient ``theme``.
    - ``company``: nhà tuyển dụng nổi bật, nội dung lấy từ ``company`` thật.
    - ``ai``: gợi ý việc làm bằng AI; ứng viên đăng nhập thấy số việc phù hợp,
      khách thấy nội dung nhập ở đây.

    ``starts_at``/``ends_at`` hẹn giờ chạy; ``placement`` để tái dùng model cho
    banner ở trang khác.
    """

    class Kind(models.TextChoices):
        IMAGE = 'image', 'Ảnh + link'
        PROMO = 'promo', 'Bố cục chữ'
        COMPANY = 'company', 'Nhà tuyển dụng nổi bật'
        AI = 'ai', 'Gợi ý việc làm AI'

    class Theme(models.TextChoices):
        GREEN = 'green', 'Xanh thương hiệu'
        BLUE = 'blue', 'Xanh đại dương'
        ORANGE = 'orange', 'Hoàng hôn'
        VIOLET = 'violet', 'Tím'
        TEAL = 'teal', 'Ngọc lam'
        ROSE = 'rose', 'Hồng đỏ'
        AURORA = 'aurora', 'Cực quang'
        MIDNIGHT = 'midnight', 'Đêm'

    class Placement(models.TextChoices):
        HOME_HERO = 'home_hero', 'Carousel trang chủ'
        JOB_DETAIL_SIDEBAR = 'job_detail_sidebar', 'Thẻ ảnh sidebar trang chi tiết việc làm'
        BLOG_SIDEBAR = 'blog_sidebar', 'Banner sidebar bài viết cẩm nang'
        # Banner "ảnh giả button": cả khối là 1 link (cta_url), chèn giữa các
        # section trang /blog và trang danh mục.
        BLOG_INLINE = 'blog_inline', 'Banner chèn giữa trang cẩm nang'
        # Hiện dưới thông báo "Rất tiếc..." khi tìm việc không có kết quả.
        JOB_EMPTY = 'job_empty', 'Banner trang việc làm khi không có kết quả'
        # Chèn giữa danh sách kết quả tìm việc (sau vài tin đầu, kiểu box TopCV Pro).
        JOB_LIST_INLINE = 'job_list_inline', 'Banner chèn giữa danh sách việc làm'

    placement = models.CharField(
        max_length=30, choices=Placement.choices, default=Placement.HOME_HERO
    )
    kind = models.CharField(max_length=20, choices=Kind.choices, default=Kind.PROMO)
    company = models.ForeignKey(
        'employers.Company',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='+',
        help_text='Bắt buộc với slide nhà tuyển dụng; với slide ảnh là đích mặc định của link',
    )
    eyebrow = models.CharField(
        max_length=100, blank=True, help_text='Nhãn nhỏ phía trên tiêu đề, vd: TUYỂN DỤNG GẤP'
    )
    title = models.CharField(max_length=200, blank=True)
    subtitle = models.CharField(max_length=300, blank=True)
    image_url = models.TextField(
        blank=True, help_text='Để trống để dùng nền gradient theo Theme bên dưới'
    )
    theme = models.CharField(max_length=20, choices=Theme.choices, default=Theme.GREEN)
    cta_label = models.CharField(
        max_length=100, blank=True, help_text='Để trống nếu banner không có nút bấm'
    )
    cta_url = models.CharField(max_length=300, blank=True)
    # Nút phụ — hiện chỉ banner sidebar blog cần 2 nút (Tạo CV + Tìm việc ngay);
    # banner 1 nút để trống cặp này.
    cta_secondary_label = models.CharField(
        max_length=100, blank=True, help_text='Nút thứ hai (vd banner blog có 2 nút)'
    )
    cta_secondary_url = models.CharField(max_length=300, blank=True)
    order = models.PositiveSmallIntegerField(default=0)
    is_active = models.BooleanField(default=True)
    starts_at = models.DateTimeField(null=True, blank=True)
    ends_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['placement', 'order', 'id']
        verbose_name = 'Banner'
        verbose_name_plural = 'Banner'

    def __str__(self):
        return self.title or (self.company.display_name if self.company_id else self.kind)

    def clean(self):
        errors = {}
        if self.kind == self.Kind.COMPANY and not self.company_id:
            errors['company'] = _('Chọn công ty cho slide nhà tuyển dụng.')
        if self.kind == self.Kind.IMAGE:
            if not self.image_url:
                errors['image_url'] = _('Slide ảnh cần ảnh banner.')
            if not self.cta_url and not self.company_id:
                errors['cta_url'] = _('Slide ảnh cần link hoặc công ty để mở khi bấm.')
        if self.kind != self.Kind.COMPANY and not self.title.strip():
            errors['title'] = _('Nhập tiêu đề banner.')
        if self.starts_at and self.ends_at and self.ends_at <= self.starts_at:
            errors['ends_at'] = _('Thời điểm kết thúc phải sau thời điểm bắt đầu.')
        if errors:
            raise ValidationError(errors)

    def schedule_state(self, now=None):
        """``off`` | ``scheduled`` | ``expired`` | ``running`` tại thời điểm ``now``."""
        if not self.is_active:
            return 'off'
        now = now or timezone.now()
        if self.starts_at and self.starts_at > now:
            return 'scheduled'
        if self.ends_at and self.ends_at <= now:
            return 'expired'
        return 'running'


class Feedback(models.Model):
    """Góp ý sản phẩm gửi từ nút nổi "Góp ý" ở các trang công khai.

    Khách chưa đăng nhập vẫn gửi được nên `user` để null; lúc đó `phone`/`email`
    (đều không bắt buộc) là cách duy nhất để phản hồi lại họ. Admin xử lý bằng
    cách chuyển `status`.
    """

    class Category(models.TextChoices):
        UI_UX = 'ui_ux', 'Giao diện, trải nghiệm'
        FEATURE = 'feature', 'Tính năng sản phẩm'
        JOB_QUALITY = 'job_quality', 'Chất lượng tin tuyển dụng'
        ACCOUNT = 'account', 'Tài khoản & bảo mật'
        PERFORMANCE = 'performance', 'Tốc độ, hiệu năng'
        OTHER = 'other', 'Khác'

    class Satisfaction(models.TextChoices):
        VERY_UNSATISFIED = 'very_unsatisfied', 'Rất không hài lòng'
        UNSATISFIED = 'unsatisfied', 'Không hài lòng'
        NEUTRAL = 'neutral', 'Bình thường'
        SATISFIED = 'satisfied', 'Hài lòng'
        VERY_SATISFIED = 'very_satisfied', 'Rất hài lòng'

    class Status(models.TextChoices):
        NEW = 'new', 'Mới'
        IN_PROGRESS = 'in_progress', 'Đang xử lý'
        RESOLVED = 'resolved', 'Đã xử lý'

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='feedbacks',
        help_text='Null nếu khách gửi khi chưa đăng nhập',
    )
    category = models.CharField(
        max_length=20,
        choices=Category.choices,
        default=Category.FEATURE,
        help_text='Chủ đề cần góp ý',
    )
    content = models.TextField(help_text='Mô tả góp ý')
    satisfaction = models.CharField(
        max_length=20,
        choices=Satisfaction.choices,
        blank=True,
        help_text='Mức hài lòng người dùng chọn (nếu có)',
    )
    phone = models.CharField(
        max_length=20, blank=True, help_text='Số điện thoại nhận phản hồi (khách)'
    )
    email = models.EmailField(
        blank=True, help_text='Email nhận phản hồi (để trống nếu không cần phản hồi)'
    )
    page_url = models.CharField(
        max_length=500, blank=True, help_text='Trang người dùng đang xem lúc gửi'
    )
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.NEW)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [models.Index(fields=['status', '-created_at'])]
        verbose_name = 'Góp ý / Hỗ trợ'
        verbose_name_plural = 'Góp ý / Hỗ trợ'

    def __str__(self):
        return f'{self.get_category_display()} - {self.content[:50]}'
