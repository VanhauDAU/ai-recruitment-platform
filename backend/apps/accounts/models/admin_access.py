from django.core.exceptions import ValidationError
from django.db import models

from common.public_id import generate_public_id

from .user import User


class AdminPermission(models.Model):
    code = models.CharField(max_length=64, unique=True)
    module = models.CharField(max_length=32)
    label = models.CharField(max_length=120)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    deprecated_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['code']

    def __str__(self):
        return self.code


class Department(models.Model):
    public_id = models.CharField(max_length=64, unique=True, editable=False)
    code = models.SlugField(max_length=64, unique=True)
    name = models.CharField(max_length=120)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    is_system_managed = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name', 'code']

    def save(self, *args, **kwargs):
        if not self.public_id:
            self.public_id = generate_public_id('dept')
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name


class AdminRole(models.Model):
    """Organizational role.

    ``rank`` controls presentation and deterministic primary selection only. It
    never grants or overrides a permission.
    """

    public_id = models.CharField(max_length=64, unique=True, editable=False)
    department = models.ForeignKey(
        Department,
        related_name='roles',
        on_delete=models.CASCADE,
    )
    code = models.SlugField(max_length=64)
    name = models.CharField(max_length=120)
    description = models.TextField(blank=True)
    rank = models.PositiveSmallIntegerField(default=0)
    is_active = models.BooleanField(default=True)
    is_system_managed = models.BooleanField(default=False)
    permissions = models.ManyToManyField(AdminPermission, related_name='roles', blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['department__name', '-rank', 'name']
        constraints = [
            models.UniqueConstraint(
                fields=['department', 'code'],
                name='uq_admin_role_department_code',
            ),
        ]

    def save(self, *args, **kwargs):
        if not self.public_id:
            self.public_id = generate_public_id('arole')
        super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.department.code}:{self.code}'


class AdminMembership(models.Model):
    public_id = models.CharField(max_length=64, unique=True, editable=False)
    user = models.ForeignKey(
        User,
        related_name='admin_memberships',
        on_delete=models.CASCADE,
    )
    role = models.ForeignKey(
        AdminRole,
        related_name='memberships',
        on_delete=models.PROTECT,
    )
    assigned_by = models.ForeignKey(
        User,
        related_name='admin_memberships_assigned',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    revoked_by = models.ForeignKey(
        User,
        related_name='admin_memberships_revoked',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    is_primary = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    assigned_at = models.DateTimeField(auto_now_add=True)
    revoked_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-assigned_at', '-id']
        constraints = [
            models.UniqueConstraint(
                fields=['user'],
                condition=models.Q(is_active=True),
                name='uq_admin_membership_active_user',
            ),
        ]

    def clean(self):
        super().clean()
        if self.user_id and not self.user.is_admin_role:
            raise ValidationError({'user': 'Membership chỉ được gán cho tài khoản admin.'})

    def save(self, *args, **kwargs):
        if not self.public_id:
            self.public_id = generate_public_id('amem')
        super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.user.email}:{self.role}'


class AdminAccessAuditLog(models.Model):
    public_id = models.CharField(max_length=64, unique=True, editable=False)
    actor = models.ForeignKey(
        User,
        related_name='admin_access_audit_logs',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    source = models.CharField(max_length=20)
    actor_identifier = models.CharField(max_length=255, blank=True)
    action = models.CharField(max_length=64)
    target_type = models.CharField(max_length=32)
    target_public_id = models.CharField(max_length=64, blank=True)
    payload = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at', '-id']
        indexes = [models.Index(fields=['created_at'], name='admin_audit_created_idx')]

    def save(self, *args, **kwargs):
        if not self.public_id:
            self.public_id = generate_public_id('alog')
        super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.action}:{self.target_type}:{self.target_public_id}'


class AdminProvisioningScope(models.Model):
    """Whitelist chức danh mà một chức danh cấp phát được phép mời."""

    public_id = models.CharField(max_length=64, unique=True, editable=False)
    source_role = models.ForeignKey(
        AdminRole,
        related_name='provisioning_scopes',
        on_delete=models.PROTECT,
    )
    target_role = models.ForeignKey(
        AdminRole,
        related_name='provisioned_by_scopes',
        on_delete=models.PROTECT,
    )
    is_active = models.BooleanField(default=True)
    configured_by = models.ForeignKey(
        User,
        related_name='configured_admin_provisioning_scopes',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['source_role__department__name', 'source_role__name', 'target_role__name']
        constraints = [
            models.UniqueConstraint(
                fields=['source_role', 'target_role'],
                name='uq_admin_provisioning_source_target',
            ),
        ]

    def save(self, *args, **kwargs):
        if not self.public_id:
            self.public_id = generate_public_id('apscope')
        super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.source_role} -> {self.target_role}'


class AdminInvitation(models.Model):
    class Status(models.TextChoices):
        PENDING = 'pending', 'Pending'
        ACCEPTED = 'accepted', 'Accepted'
        REVOKED = 'revoked', 'Revoked'
        EXPIRED = 'expired', 'Expired'

    public_id = models.CharField(max_length=64, unique=True, editable=False)
    user = models.ForeignKey(
        User,
        related_name='admin_invitations_received',
        on_delete=models.PROTECT,
    )
    target_role = models.ForeignKey(
        AdminRole,
        related_name='admin_invitations',
        on_delete=models.PROTECT,
    )
    provisioning_scope = models.ForeignKey(
        AdminProvisioningScope,
        related_name='admin_invitations',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
    )
    invited_by = models.ForeignKey(
        User,
        related_name='admin_invitations_sent',
        on_delete=models.PROTECT,
    )
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    reason = models.CharField(max_length=500)
    token_version = models.PositiveIntegerField(default=1)
    expires_at = models.DateTimeField()
    accepted_at = models.DateTimeField(null=True, blank=True)
    revoked_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at', '-id']
        constraints = [
            models.UniqueConstraint(
                fields=['user'],
                condition=models.Q(status='pending'),
                name='uq_admin_invitation_pending_user',
            ),
        ]
        indexes = [
            models.Index(fields=['status', 'expires_at'], name='admin_invite_status_exp_idx'),
            models.Index(fields=['invited_by', 'status'], name='admin_invite_actor_status_idx'),
        ]

    def save(self, *args, **kwargs):
        if not self.public_id:
            self.public_id = generate_public_id('ainv')
        super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.user.email}:{self.target_role}:{self.status}'
