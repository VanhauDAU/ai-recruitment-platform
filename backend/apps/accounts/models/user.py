import uuid

from django.contrib.auth.base_user import BaseUserManager
from django.contrib.auth.models import AbstractUser
from django.db import models
from django.db.models.functions import Lower
from django.utils import timezone, translation

from ..domain.account_code import (
    ACCOUNT_CODE_LENGTH,
    ACCOUNT_CODE_REGEX,
    random_account_code,
)

# 9·10^7 mã khả dụng: trùng liên tiếp chừng này lần nghĩa là bảng gần đầy.
ACCOUNT_CODE_ATTEMPTS = 20


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
        # Tài khoản mới lấy ngôn ngữ giao diện đang dùng lúc đăng ký (Accept-Language),
        # để NTD nước ngoài chọn English rồi đăng ký không bị trả về tiếng Việt.
        extra_fields.setdefault('preferred_language', self._active_language())
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def _active_language(self):
        code = (translation.get_language() or '').split('-')[0]
        languages = self.model.Language
        return code if code in languages.values else languages.VI

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault('role', User.Role.ADMIN)
        extra_fields.setdefault('status', User.Status.ACTIVE)
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        return self.create_user(email, password, **extra_fields)

    def new_public_id(self):
        """Mã tài khoản 8 chữ số chưa ai dùng; ràng buộc unique vẫn là chốt cuối."""
        for _ in range(ACCOUNT_CODE_ATTEMPTS):
            code = random_account_code()
            if not self.filter(public_id=code).exists():
                return code
        raise RuntimeError('Không còn mã tài khoản trống sau nhiều lần thử.')

    def email_claimed_for_role(self, email, role, *, exclude_user_id=None):
        """Whether an email identity is already owned inside a portal.

        A verified OAuth address remains an identity of its linked account even
        when that account later changes its password-login email. Ignoring
        ``SocialAccount.email`` would allow a second same-role account to claim
        the OAuth address and make password/OAuth login resolve to two users.
        """
        email = self.normalize_email(email)
        users = self.filter(email__iexact=email, role=role)
        social_accounts = SocialAccount.objects.filter(
            email__iexact=email,
            user__role=role,
        )
        if exclude_user_id is not None:
            users = users.exclude(pk=exclude_user_id)
            social_accounts = social_accounts.exclude(user_id=exclude_user_id)
        return users.exists() or social_accounts.exists()


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

    class Language(models.TextChoices):
        VI = 'vi', 'Tiếng Việt'
        EN = 'en', 'English'

    class Provider(models.TextChoices):
        LOCAL = 'local', 'Local'
        GOOGLE = 'google', 'Google'
        FACEBOOK = 'facebook', 'Facebook'
        LINKEDIN = 'linkedin', 'LinkedIn'
        GITHUB = 'github', 'GitHub'

    username = None
    first_name = None
    last_name = None

    # Mã tài khoản hiển thị cho người dùng và bộ phận hỗ trợ (xem domain/account_code).
    public_id = models.CharField(max_length=ACCOUNT_CODE_LENGTH, unique=True, editable=False)
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
    # Ngôn ngữ giao diện, email và thông báo của tài khoản (mỗi cổng một tài khoản).
    preferred_language = models.CharField(
        max_length=8, choices=Language.choices, default=Language.VI
    )
    # Monotonic security boundary for every issued session or pre-auth artifact.
    # Recovery actions bump this value so work already in flight cannot create a
    # usable token after the account identity has changed.
    auth_revision = models.PositiveBigIntegerField(default=1)
    is_deleted = models.BooleanField(default=False)
    deleted_at = models.DateTimeField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = []

    objects = UserManager()

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=models.Q(status__in=['active', 'inactive', 'banned', 'pending']),
                name='chk_users_status',
            ),
            models.CheckConstraint(
                condition=models.Q(role__in=['candidate', 'employer', 'admin']),
                name='chk_users_role',
            ),
            models.CheckConstraint(
                condition=models.Q(public_id__regex=ACCOUNT_CODE_REGEX),
                name='chk_users_public_id_digits',
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
            self.public_id = User.objects.new_public_id()
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
        ADMIN_INVITATION = 'admin_invitation', 'Admin invitation'
        EMAIL_CHANGED_NOTICE = 'email_changed_notice', 'Email changed security notice'
        ACCOUNT_STATUS_NOTICE = 'account_status_notice', 'Account status security notice'
        PASSWORD_SETUP_CODE = 'password_setup_code', 'Password setup verification code'

    class Status(models.TextChoices):
        PENDING = 'pending', 'Pending'
        SENDING = 'sending', 'Sending'
        SENT = 'sent', 'Sent'
        FAILED = 'failed', 'Failed'
        CANCELLED = 'cancelled', 'Cancelled'

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
    auth_revision = models.PositiveBigIntegerField(default=1)
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
            models.Index(
                fields=['user', 'portal', 'ip_address', 'revoked_at'],
                name='auth_session_device_active_idx',
            ),
        ]
        constraints = [
            models.UniqueConstraint(fields=['refresh_jti'], name='uq_auth_session_refresh_jti'),
        ]

    def __str__(self):
        return f'{self.user_id}:{self.portal}:{self.device_label}'
