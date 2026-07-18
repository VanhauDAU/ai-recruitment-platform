from django.db import models


class ServiceCategory(models.Model):
    """Nhóm dịch vụ trên trang báo giá NTD (vd: Tin nổi bật, AI & Credits).

    Nội dung song ngữ theo cột đôi `*_vi`/`*_en`; cột `en` để trống thì frontend
    fallback về tiếng Việt.
    """

    key = models.SlugField(max_length=50, unique=True, help_text='Định danh dùng trong URL/anchor, vd: featured-jobs')
    name_vi = models.CharField(max_length=120)
    name_en = models.CharField(max_length=120, blank=True)
    description_vi = models.TextField(blank=True)
    description_en = models.TextField(blank=True)
    icon = models.CharField(max_length=50, blank=True, help_text='Tên icon antd, vd: ThunderboltOutlined')
    order = models.PositiveSmallIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['order', 'key']
        verbose_name = 'Nhóm dịch vụ'
        verbose_name_plural = 'Nhóm dịch vụ'

    def __str__(self):
        return self.name_vi


class ServicePackage(models.Model):
    """Gói dịch vụ hiển thị trên trang báo giá; admin quản lý giá và quyền lợi."""

    class CtaType(models.TextChoices):
        REGISTER = 'register', 'Đăng ký tài khoản'
        CONTACT = 'contact', 'Liên hệ tư vấn'

    category = models.ForeignKey(ServiceCategory, on_delete=models.PROTECT, related_name='packages')
    slug = models.SlugField(max_length=80, unique=True)
    name_vi = models.CharField(max_length=120)
    name_en = models.CharField(max_length=120, blank=True)
    tagline_vi = models.CharField(max_length=255, blank=True, help_text='Mô tả 1 dòng dưới tên gói')
    tagline_en = models.CharField(max_length=255, blank=True)
    price = models.DecimalField(max_digits=12, decimal_places=0, null=True, blank=True,
                                help_text='Để trống = hiển thị "Liên hệ"')
    currency = models.CharField(max_length=10, default='VND')
    unit_vi = models.CharField(max_length=100, blank=True, help_text='VD: / tin đăng 30 ngày')
    unit_en = models.CharField(max_length=100, blank=True)
    vat_note_vi = models.CharField(max_length=100, blank=True, default='Giá chưa bao gồm VAT')
    vat_note_en = models.CharField(max_length=100, blank=True, default='Price excludes VAT')
    benefits_vi = models.JSONField(default=list, blank=True, help_text='Danh sách quyền lợi (list chuỗi)')
    benefits_en = models.JSONField(default=list, blank=True)
    badge_vi = models.CharField(max_length=50, blank=True, help_text='Nhãn nổi bật trên card, vd: Bán chạy nhất')
    badge_en = models.CharField(max_length=50, blank=True)
    is_highlight = models.BooleanField(default=False, help_text='Card viền màu thương hiệu')
    cta_type = models.CharField(max_length=20, choices=CtaType.choices, default=CtaType.CONTACT)
    order = models.PositiveSmallIntegerField(default=0)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['category__order', 'order', 'slug']
        verbose_name = 'Gói dịch vụ'
        verbose_name_plural = 'Gói dịch vụ'

    def __str__(self):
        return self.name_vi


class ConsultationLead(models.Model):
    """Yêu cầu tư vấn tuyển dụng gửi từ form trên các trang marketing NTD.

    Khách chưa đăng nhập vẫn gửi được; admin xử lý bằng cách chuyển `status`.
    `province` lưu label chuỗi (không FK) để lead là bản ghi liên hệ độc lập,
    không vỡ khi dữ liệu địa điểm thay đổi.
    """

    class Need(models.TextChoices):
        POST_JOB = 'post_job', 'Đăng tin tuyển dụng'
        BUY_SERVICE = 'buy_service', 'Tìm hiểu gói dịch vụ'
        AI_SOLUTION = 'ai_solution', 'Giải pháp AI sàng lọc CV'
        EMPLOYER_BRANDING = 'employer_branding', 'Truyền thông thương hiệu'
        OTHER = 'other', 'Khác'

    class Status(models.TextChoices):
        NEW = 'new', 'Mới'
        CONTACTED = 'contacted', 'Đã liên hệ'

    full_name = models.CharField(max_length=120)
    company_name = models.CharField(max_length=200, blank=True)
    email = models.EmailField()
    phone = models.CharField(max_length=20)
    province = models.CharField(max_length=100, blank=True)
    need = models.CharField(max_length=30, choices=Need.choices, default=Need.POST_JOB)
    note = models.TextField(blank=True)
    source_page = models.CharField(max_length=500, blank=True, help_text='Trang khách đang xem lúc gửi')
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.NEW)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [models.Index(fields=['status', '-created_at'])]
        verbose_name = 'Lead tư vấn'
        verbose_name_plural = 'Lead tư vấn'

    def __str__(self):
        return f'{self.full_name} ({self.phone})'
