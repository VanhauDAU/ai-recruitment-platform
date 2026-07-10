from django.contrib.auth.base_user import BaseUserManager
from django.contrib.auth.models import AbstractUser
from django.db import models
from django.db.models.functions import Lower

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

        `ModelBackend.authenticate()` gọi hàm này. Ràng buộc `uniq_users_email_lower`
        đảm bảo `iexact` không bao giờ khớp quá 1 bản ghi.
        """
        return self.get(**{f'{self.model.USERNAME_FIELD}__iexact': username})

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
    email = models.EmailField(unique=True)
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.CANDIDATE)
    full_name = models.CharField(max_length=255, blank=True)
    phone = models.CharField(max_length=20, blank=True)
    avatar_url = models.TextField(blank=True)
    provider = models.CharField(max_length=50, choices=Provider.choices, default=Provider.LOCAL)
    provider_id = models.CharField(max_length=255, blank=True)
    status = models.CharField(max_length=50, choices=Status.choices, default=Status.ACTIVE)
    email_verified = models.BooleanField(default=False)
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
            # `email` đã unique nhưng Postgres so sánh phân biệt hoa/thường; ràng
            # buộc này chặn tạo thêm `Hau@gmail.com` khi đã có `hau@gmail.com`,
            # đồng thời bảo đảm `get_by_natural_key` (iexact) chỉ khớp 1 bản ghi.
            models.UniqueConstraint(
                Lower('email'),
                name='uniq_users_email_lower',
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
            models.UniqueConstraint(fields=['provider', 'provider_user_id'], name='uq_social_provider_uid'),
        ]

    def __str__(self):
        return f'{self.provider}:{self.provider_user_id} -> {self.user_id}'


class AuthEmailJob(models.Model):
    """Transactional outbox for security-sensitive authentication emails."""

    class Kind(models.TextChoices):
        VERIFICATION = 'verification', 'Email verification'
        PASSWORD_RESET = 'password_reset', 'Password reset'

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
    started_at = models.DateTimeField(null=True, blank=True)
    sent_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=['status', 'created_at'], name='auth_email_status_created_idx'),
        ]

    def __str__(self):
        return f'{self.kind}:{self.user_id}:{self.status}'
