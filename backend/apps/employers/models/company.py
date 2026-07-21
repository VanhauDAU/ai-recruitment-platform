from django.conf import settings
from django.db import models
from django.utils.text import slugify

from common.public_id import generate_public_id


class Industry(models.Model):
    """Lĩnh vực hoạt động (Fintech, Bán lẻ, Giáo dục...). Một công ty có thể
    thuộc nhiều lĩnh vực cùng lúc — xem `Company.industries`."""

    name = models.CharField(max_length=255, unique=True)
    slug = models.SlugField(max_length=255, unique=True, blank=True)

    class Meta:
        verbose_name_plural = 'industries'
        ordering = ['name']

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name


class Company(models.Model):
    """Pháp nhân tuyển dụng — tách khỏi tài khoản nhà tuyển dụng để nhiều HR
    dùng chung một công ty đã xác thực. Xem kế hoạch:
    docs/03-database/ke-hoach-thiet-ke-lai-cong-ty-nha-tuyen-dung.md.

    """

    class BusinessType(models.TextChoices):
        ENTERPRISE = 'enterprise', 'Doanh nghiệp'
        HOUSEHOLD = 'household', 'Hộ kinh doanh'

    class Size(models.TextChoices):
        S1_9 = '1-9', '1 - 9 nhân viên'
        S10_24 = '10-24', '10 - 24 nhân viên'
        S25_99 = '25-99', '25 - 99 nhân viên'
        S100_499 = '100-499', '100 - 499 nhân viên'
        S500_1000 = '500-1000', '500 - 1000 nhân viên'
        S1000_PLUS = '1000+', '1000+ nhân viên'
        S3000_PLUS = '3000+', '3000+ nhân viên'
        S5000_PLUS = '5000+', '5000+ nhân viên'
        S10000_PLUS = '10000+', '10000+ nhân viên'

    class VerificationStatus(models.TextChoices):
        UNVERIFIED = 'unverified', 'Chưa xác thực'
        PENDING = 'pending', 'Chờ duyệt'
        VERIFIED = 'verified', 'Đã xác thực'
        REJECTED = 'rejected', 'Bị từ chối'

    class Market(models.TextChoices):
        DOMESTIC = 'domestic', 'Nội địa'
        ASIA = 'asia', 'Châu Á'
        EUROPE = 'europe', 'Châu Âu'
        AFRICA = 'africa', 'Châu Phi'
        AMERICA = 'america', 'Châu Mỹ'
        AUSTRALIA = 'australia', 'Châu Úc'

    class TargetCustomer(models.TextChoices):
        B2B = 'b2b', 'B2B'
        B2C = 'b2c', 'B2C'
        B2G = 'b2g', 'B2G'

    public_id = models.CharField(max_length=50, unique=True, editable=False)
    slug = models.SlugField(max_length=255, unique=True, blank=True)
    business_type = models.CharField(
        max_length=20, choices=BusinessType.choices, default=BusinessType.ENTERPRISE
    )
    # Với hộ kinh doanh là MST người đại diện. Unique (nhiều NULL được phép)
    # là chốt chặn chống tạo trùng công ty; chuỗi rỗng chuẩn hoá về NULL ở save().
    tax_code = models.CharField(max_length=100, unique=True, null=True, blank=True)
    company_name = models.CharField(max_length=255)
    trade_name = models.CharField(max_length=255, blank=True)
    trade_name_same_as_registered = models.BooleanField(default=False)
    logo_url = models.TextField(blank=True)
    has_no_logo = models.BooleanField(default=False)
    cover_image_url = models.TextField(blank=True)
    website_url = models.TextField(blank=True)
    has_no_website = models.BooleanField(default=False)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=20, blank=True)
    address = models.TextField(blank=True)
    company_size = models.CharField(max_length=100, choices=Size.choices, blank=True)
    description = models.TextField(blank=True)
    employee_benefits = models.TextField(blank=True)
    # Danh sách giá trị enum Market/TargetCustomer; để JSON vì hiếm khi cần
    # filter — nâng thành bảng riêng nếu về sau có nhu cầu truy vấn.
    markets = models.JSONField(default=list, blank=True)
    target_customers = models.JSONField(default=list, blank=True)
    industries = models.ManyToManyField(
        Industry, through='CompanyIndustry', blank=True, related_name='companies'
    )
    founded_year = models.IntegerField(null=True, blank=True)
    has_brand_page = models.BooleanField(
        default=False,
        help_text='Bật trang thương hiệu — tin tuyển dụng hiển thị dưới URL /brand/... với header công ty',
    )
    verification_status = models.CharField(
        max_length=20, choices=VerificationStatus.choices, default=VerificationStatus.UNVERIFIED
    )
    verified_at = models.DateTimeField(null=True, blank=True)
    rejected_reason = models.TextField(blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='companies_created'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name_plural = 'companies'

    def save(self, *args, **kwargs):
        if not self.public_id:
            self.public_id = generate_public_id('co')
        if not self.slug:
            self.slug = slugify(self.company_name)
        self.tax_code = self.tax_code or None
        super().save(*args, **kwargs)

    def __str__(self):
        return self.company_name


class CompanyIndustry(models.Model):
    """Lĩnh vực hoạt động của công ty; đúng 1 lĩnh vực chính (`is_primary`)
    và lĩnh vực chính hiển nhiên nằm trong các lĩnh vực đã chọn (cùng hàng)."""

    company = models.ForeignKey(
        Company, on_delete=models.CASCADE, related_name='company_industries'
    )
    industry = models.ForeignKey(Industry, on_delete=models.CASCADE, related_name='+')
    is_primary = models.BooleanField(default=False)

    class Meta:
        verbose_name_plural = 'company industries'
        constraints = [
            models.UniqueConstraint(fields=['company', 'industry'], name='uniq_company_industry'),
            models.UniqueConstraint(
                fields=['company'],
                condition=models.Q(is_primary=True),
                name='uniq_company_primary_industry',
            ),
        ]

    def __str__(self):
        return f'{self.company_id}:{self.industry_id}{" *" if self.is_primary else ""}'


class CompanyImage(models.Model):
    """Ảnh giới thiệu công ty (địa điểm làm việc, sản phẩm, hoạt động).
    Khuyến nghị tỉ lệ 3:2 (1200x800) — validate ở API, không ràng buộc DB."""

    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name='images')
    image_url = models.TextField()
    caption = models.CharField(max_length=255, blank=True)
    sort_order = models.PositiveSmallIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['sort_order', 'id']

    def __str__(self):
        return f'{self.company_id}:{self.image_url[:50]}'
