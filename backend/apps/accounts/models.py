import uuid

from django.contrib.auth.base_user import BaseUserManager
from django.contrib.auth.models import AbstractUser
from django.db import models
from django.db.models.functions import Lower
from django.utils import timezone

from common.public_id import generate_public_id


class UserManager(BaseUserManager):
    @classmethod
    def normalize_email(cls, email):
        """Hạ chữ TOÀN BỘ email, không chỉ phần domain.

        `BaseUserManager.normalize_email` chỉ hạ chữ phần sau `@`, nên
        `Hau@gmail.com` và `hau@gmail.com` là 2 bản ghi khác nhau. Trong thực tế
        không ai coi đó là 2 tài khoản, và nó từng gây ra lệch giữa các luồng:
        đặt lại mật khẩu tra `email__iexact` (tìm thấy) còn đăng nhập tra chính
        xác (không thấy) -> đổi mật khẩu xong vẫn không đăng nhập được.
        """
        return super().normalize_email(email).lower()

    def get_by_natural_key(self, username):
        """Đăng nhập không phân biệt hoa/thường.

        Mô hình tách tài khoản theo cổng (giống TopCV): cùng một email có thể
        thuộc nhiều `role`, nên `email` KHÔNG còn unique toàn cục. Các cổng app tự
        resolve theo (email, role) khi đăng nhập; hàm này chỉ phục vụ
        `ModelBackend.authenticate()` (Django admin site) nên khi email trùng
        nhiều bản ghi thì ưu tiên tài khoản staff/superuser.
        """
        return (
            self.filter(**{f'{self.model.USERNAME_FIELD}__iexact': username})
            .order_by('-is_superuser', '-is_staff', 'pk')
            .first()
            or self.get(**{f'{self.model.USERNAME_FIELD}__iexact': username})  # raise DoesNotExist
        )

    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError('Email is required')
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault('role', User.Role.ADMIN)
        extra_fields.setdefault('status', User.Status.ACTIVE)
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        return self.create_user(email, password, **extra_fields)


class User(AbstractUser):
    class Role(models.TextChoices):
        CANDIDATE = 'candidate', 'Candidate'
        EMPLOYER = 'employer', 'Employer'
        ADMIN = 'admin', 'Admin'

    class Status(models.TextChoices):
        ACTIVE = 'active', 'Active'
        INACTIVE = 'inactive', 'Inactive'
        BANNED = 'banned', 'Banned'
        PENDING = 'pending', 'Pending'

    class Provider(models.TextChoices):
        LOCAL = 'local', 'Local'
        GOOGLE = 'google', 'Google'
        FACEBOOK = 'facebook', 'Facebook'
        LINKEDIN = 'linkedin', 'LinkedIn'
        GITHUB = 'github', 'GitHub'

    username = None
    first_name = None
    last_name = None

    public_id = models.CharField(max_length=50, unique=True, editable=False)
    # Email KHÔNG unique toàn cục: một email dùng được cho tối đa một tài khoản
    # mỗi role (ứng viên / NTD / admin) — mô hình tách cổng giống TopCV. Tính duy
    # nhất được đảm bảo bởi ràng buộc (Lower(email), role) trong Meta.
    email = models.EmailField()
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.CANDIDATE)
    full_name = models.CharField(max_length=255, blank=True)
    phone = models.CharField(max_length=20, blank=True)
    avatar_url = models.TextField(blank=True)
    status = models.CharField(max_length=50, choices=Status.choices, default=Status.ACTIVE)
    email_verified = models.BooleanField(default=False)
    two_factor_enabled = models.BooleanField(default=False)
    is_deleted = models.BooleanField(default=False)
    deleted_at = models.DateTimeField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = []

    objects = UserManager()

    class Meta:
        constraints = [
            models.CheckConstraint(
                check=models.Q(status__in=['active', 'inactive', 'banned', 'pending']),
                name='chk_users_status',
            ),
            models.CheckConstraint(
                check=models.Q(role__in=['candidate', 'employer', 'admin']),
                name='chk_users_role',
            ),
            # Duy nhất theo (email, role), không phân biệt hoa/thường: chặn tạo hai
            # tài khoản cùng cổng cho một email, nhưng CHO PHÉP cùng email tồn tại
            # ở khác cổng (ứng viên vs NTD) — mỗi tài khoản mật khẩu riêng.
            models.UniqueConstraint(
                Lower('email'),
                'role',
                name='uniq_users_email_role_lower',
            ),
        ]

    def save(self, *args, **kwargs):
        if not self.public_id:
            self.public_id = generate_public_id('usr')
        super().save(*args, **kwargs)

    def __str__(self):
        return self.email

    @property
    def is_candidate(self):
        return self.role == self.Role.CANDIDATE

    @property
    def is_employer(self):
        return self.role == self.Role.EMPLOYER

    @property
    def is_admin_role(self):
        return self.role == self.Role.ADMIN


class SocialAccount(models.Model):
    """Liên kết tài khoản mạng xã hội (OAuth) với user.

    Một user có thể liên kết nhiều provider; mỗi danh tính provider
    (provider, provider_user_id) chỉ thuộc về đúng một user.
    """

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='social_accounts')
    provider = models.CharField(max_length=50, choices=User.Provider.choices)
    provider_user_id = models.CharField(max_length=255)
    email = models.EmailField(blank=True)
    raw_profile = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            # Cùng một danh tính social (google-id) gắn được vào NHIỀU tài khoản
            # cùng email khác cổng (ứng viên + NTD) — nên khoá theo (provider,
            # provider_user_id, user) thay vì chỉ (provider, provider_user_id).
            # Việc "mỗi cổng một tài khoản" do luật (email, role) ở User đảm bảo.
            models.UniqueConstraint(
                fields=['provider', 'provider_user_id', 'user'],
                name='uq_social_provider_uid_user',
            ),
        ]

    def __str__(self):
        return f'{self.provider}:{self.provider_user_id} -> {self.user_id}'


class AuthEmailJob(models.Model):
    """Transactional outbox for security-sensitive authentication emails."""

    class Kind(models.TextChoices):
        VERIFICATION = 'verification', 'Email verification'
        WELCOME = 'welcome', 'Welcome email'
        PASSWORD_RESET = 'password_reset', 'Password reset'
        TWO_FACTOR = 'two_factor', 'Two-factor authentication code'

    class Status(models.TextChoices):
        PENDING = 'pending', 'Pending'
        SENDING = 'sending', 'Sending'
        SENT = 'sent', 'Sent'
        FAILED = 'failed', 'Failed'

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='auth_email_jobs')
    kind = models.CharField(max_length=30, choices=Kind.choices)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    attempts = models.PositiveSmallIntegerField(default=0)
    last_error = models.TextField(blank=True)
    context = models.JSONField(default=dict, blank=True)
    started_at = models.DateTimeField(null=True, blank=True)
    sent_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=['status', 'created_at'], name='auth_email_status_created_idx'),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=['user', 'kind'],
                condition=models.Q(kind='welcome'),
                name='uq_auth_email_welcome_per_user',
            ),
        ]

    def __str__(self):
        return f'{self.kind}:{self.user_id}:{self.status}'


class AuthSession(models.Model):
    """Một phiên đăng nhập (một thiết bị) của một tài khoản.

    `id` được nhúng vào JWT dưới claim `sid` để nhận diện thiết bị hiện tại khi
    liệt kê. `refresh_jti` trỏ tới refresh token đang hiệu lực của phiên; khi
    refresh xoay vòng, `refresh_jti` được cập nhật để phiên xuyên suốt. Chỉ lưu
    jti (không lưu access/refresh token thô). Mỗi request access token bắt buộc
    có `sid` trỏ tới row còn hiệu lực; blacklist SimpleJWT bảo vệ thêm luồng
    refresh và `revoked_at` chặn access token ngay lập tức.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='auth_sessions')
    # Cổng của phiên = role của tài khoản (mô hình tách tài khoản theo cổng).
    portal = models.CharField(max_length=20, choices=User.Role.choices)
    refresh_jti = models.CharField(max_length=64, db_index=True)
    auth_method = models.CharField(max_length=20, default='password')
    device_label = models.CharField(max_length=120, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.CharField(max_length=400, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    last_seen_at = models.DateTimeField(auto_now_add=True)
    reauthenticated_at = models.DateTimeField(default=timezone.now)
    expires_at = models.DateTimeField()
    revoked_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-last_seen_at']
        indexes = [
            models.Index(fields=['user', 'revoked_at'], name='auth_session_user_active_idx'),
        ]
        constraints = [
            models.UniqueConstraint(fields=['refresh_jti'], name='uq_auth_session_refresh_jti'),
        ]

    def __str__(self):
        return f'{self.user_id}:{self.portal}:{self.device_label}'
