from django.conf import settings
from django.db import models

from common.public_id import generate_public_id

from .company import Company


class RecruiterProfile(models.Model):
    """Hồ sơ nhà tuyển dụng — 1-1 với user, gắn với đúng 1 công ty.

    Đã gán công ty thì không đổi được (enforce ở tầng service: chỉ set khi
    đang null). Owner tạo công ty mới hoặc member chọn công ty có sẵn đều có
    hiệu lực ngay. Việc xác thực pháp nhân và các thay đổi thông tin công ty
    là workflow riêng, không phải workflow duyệt thành viên.

    Các bước onboarding suy ra từ dữ liệu, không có bảng riêng. Xác thực số
    điện thoại và chọn/tạo công ty là hai bước độc lập; company không yêu cầu
    `phone_verified_at`:
    1) phone_verified_at  2) company IS NOT NULL
    3) CompanyDocument(business_registration)  4) văn bản DLCN ứng viên
    5) dpa_accepted_at với nền tảng  6) tồn tại Job của user.
    """

    class CompanyRole(models.TextChoices):
        OWNER = 'owner', 'Người tạo công ty'
        MEMBER = 'member', 'Thành viên'

    class Gender(models.TextChoices):
        MALE = 'male', 'Nam'
        FEMALE = 'female', 'Nữ'
        OTHER = 'other', 'Khác'

    public_id = models.CharField(max_length=50, unique=True, editable=False)
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='recruiter_profile'
    )
    company = models.ForeignKey(
        Company, on_delete=models.PROTECT, null=True, blank=True, related_name='recruiters'
    )
    company_role = models.CharField(max_length=20, choices=CompanyRole.choices, blank=True)
    position_title = models.CharField(max_length=255, blank=True)
    gender = models.CharField(max_length=10, choices=Gender.choices, blank=True)
    contact_phone = models.CharField(
        max_length=20,
        null=True,
        blank=True,
        help_text='Số điện thoại cá nhân khai báo khi đăng ký; xác thực riêng qua OTP.',
    )
    work_location = models.ForeignKey(
        'locations.Location',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='+',
    )
    registration_completed_at = models.DateTimeField(null=True, blank=True)
    terms_accepted_at = models.DateTimeField(null=True, blank=True)
    terms_policy_version = models.CharField(max_length=30, blank=True)
    marketing_opt_in = models.BooleanField(default=False)
    marketing_decided_at = models.DateTimeField(null=True, blank=True)
    # SĐT đã xác thực OTP; partial unique sinh ra đúng lỗi nghiệp vụ
    # "Đã có nhà tuyển dụng khác xác thực số điện thoại này".
    verified_phone = models.CharField(max_length=20, blank=True)
    phone_verified_at = models.DateTimeField(null=True, blank=True)
    dpa_accepted_at = models.DateTimeField(null=True, blank=True)
    onboarding_completed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['verified_phone'],
                condition=~models.Q(verified_phone=''),
                name='uniq_recruiter_verified_phone',
            ),
        ]

    def save(self, *args, **kwargs):
        if not self.public_id:
            self.public_id = generate_public_id('rec')
        super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.user_id}:{self.company_id or "no-company"}'
