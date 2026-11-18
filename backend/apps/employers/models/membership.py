from django.conf import settings
from django.db import models

from apps.employers.domain.phone import same_phone
from common.db.public_id import generate_public_id

from .company import Company


class RecruiterProfile(models.Model):
    """Hồ sơ nhà tuyển dụng — 1-1 với user, gắn với đúng 1 công ty.

    Đã gán công ty thì không đổi được (enforce ở tầng service: chỉ set khi
    đang null). Người tạo công ty mới là owner ngay; tham gia công ty có sẵn
    đi qua ``CompanyJoinRequest`` và chỉ có hiệu lực khi owner duyệt. Xác
    thực từng nhà tuyển dụng và thay đổi thông tin công ty là workflow riêng.

    Các bước onboarding suy ra từ dữ liệu, không có bảng riêng. Xác thực số
    điện thoại và chọn/tạo công ty là hai bước độc lập; company không yêu cầu
    `phone_verified_at`:
    1) phone_verified_at  2) company IS NOT NULL
    3) GPKD hoặc ủy quyền + định danh  4) văn bản DLCN ứng viên
    5) dpa_accepted_at với nền tảng  6) tồn tại Job của user.
    """

    class CompanyRole(models.TextChoices):
        OWNER = 'owner', 'Quản lý công ty'
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
    # NULL = chưa đăng ký: API hồ sơ NTD trả null (schema nullable) cho tới khi khai.
    contact_phone = models.CharField(  # noqa: DJ001
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
    # NULL = chưa xác thực: API hồ sơ NTD trả null (schema nullable).
    verified_phone = models.CharField(max_length=20, null=True, blank=True, default=None)  # noqa: DJ001
    phone_verified_at = models.DateTimeField(null=True, blank=True)
    dpa_accepted_at = models.DateTimeField(null=True, blank=True)
    dpa_policy_version = models.CharField(max_length=64, blank=True)
    dpa_document_sha256 = models.CharField(max_length=64, blank=True)
    dpa_grace_started_at = models.DateTimeField(null=True, blank=True)
    dpa_grace_expires_at = models.DateTimeField(null=True, blank=True)
    dpa_grace_rollout_id = models.CharField(max_length=64, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['verified_phone'],
                condition=models.Q(verified_phone__isnull=False) & ~models.Q(verified_phone=''),
                name='uniq_recruiter_verified_phone',
            ),
            models.CheckConstraint(
                condition=(
                    models.Q(
                        dpa_grace_started_at__isnull=True,
                        dpa_grace_expires_at__isnull=True,
                        dpa_grace_rollout_id='',
                    )
                    | (
                        models.Q(
                            dpa_grace_started_at__isnull=False,
                            dpa_grace_expires_at__isnull=False,
                        )
                        & ~models.Q(dpa_grace_rollout_id='')
                        & models.Q(dpa_grace_expires_at__gt=models.F('dpa_grace_started_at'))
                    )
                ),
                name='employer_dpa_grace_state_consistent',
            ),
        ]

    def __str__(self):
        return f'{self.user_id}:{self.company_id or "no-company"}'

    def save(self, *args, **kwargs):
        if not self.public_id:
            self.public_id = generate_public_id('rec')
        super().save(*args, **kwargs)

    @property
    def has_verified_phone(self):
        """The one rule for "phone verified", used by every screen and gate.

        The verified number must still be the contact and login number; the
        same line stored as 0xxx or +84xxx counts as one.
        """
        return bool(
            self.phone_verified_at
            and self.verified_phone
            and same_phone(self.contact_phone, self.verified_phone)
            and same_phone(self.user.phone, self.verified_phone)
        )


class EmployerCompanyLinkEvent(models.Model):
    """Append-only audit trail for high-risk recruiter/company recovery."""

    class EventType(models.TextChoices):
        ADMIN_UNLINKED = 'admin_unlinked', 'Admin gỡ liên kết công ty'
        OWNERSHIP_TRANSFERRED = 'ownership_transferred', 'Chuyển quyền quản lý công ty'
        OWNER_ASSIGNED = 'owner_assigned', 'Admin chỉ định quản lý công ty'
        MEMBER_REMOVED = 'member_removed', 'Quản lý công ty gỡ thành viên'
        RESOURCES_HANDED_OVER = 'resources_handed_over', 'Giao tin tuyển dụng cho thành viên khác'

    public_id = models.CharField(max_length=50, unique=True, editable=False)
    recruiter = models.ForeignKey(
        RecruiterProfile,
        on_delete=models.PROTECT,
        related_name='company_link_events',
    )
    company = models.ForeignKey(
        Company,
        on_delete=models.PROTECT,
        related_name='+',
    )
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='+',
    )
    event_type = models.CharField(max_length=32, choices=EventType.choices)
    reason = models.TextField()
    impact_snapshot = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at', '-id']
        indexes = [
            models.Index(
                fields=['recruiter', '-created_at'],
                name='emp_link_event_actor_time_idx',
            ),
        ]

    def __str__(self):
        return f'{self.public_id}:{self.event_type}'

    def save(self, *args, **kwargs):
        if not self.public_id:
            self.public_id = generate_public_id('ele')
        super().save(*args, **kwargs)


class CompanyJoinRequest(models.Model):
    """A recruiter's request to join an existing company ("duyệt tham gia").

    An eligible owner (active and verified) decides; when the company has none,
    an administrator decides instead. Joining never verifies the recruiter:
    "xác thực tài khoản" is the separate admin review of their documents. A
    recruiter has at most one pending request.
    """

    class Status(models.TextChoices):
        PENDING = 'pending', 'Chờ duyệt'
        APPROVED = 'approved', 'Đã duyệt'
        REJECTED = 'rejected', 'Từ chối'
        CANCELLED = 'cancelled', 'Đã hủy'

    public_id = models.CharField(max_length=50, unique=True, editable=False)
    recruiter = models.ForeignKey(
        RecruiterProfile, on_delete=models.CASCADE, related_name='company_join_requests'
    )
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name='join_requests')
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.PENDING)
    decided_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='+',
    )
    decided_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at', '-id']
        constraints = [
            models.UniqueConstraint(
                fields=['recruiter'],
                condition=models.Q(status='pending'),
                name='uniq_pending_company_join_per_recruiter',
            ),
        ]
        indexes = [models.Index(fields=['company', 'status'], name='company_join_status_idx')]

    def __str__(self):
        return f'{self.public_id}:{self.status}'

    def save(self, *args, **kwargs):
        if not self.public_id:
            self.public_id = generate_public_id('cjr')
        super().save(*args, **kwargs)
