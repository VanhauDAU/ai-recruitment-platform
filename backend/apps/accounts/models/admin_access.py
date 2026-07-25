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
        ordering = ['-is_primary', '-role__rank', 'assigned_at', 'id']
        constraints = [
            models.UniqueConstraint(
                fields=['user', 'role'],
                condition=models.Q(is_active=True),
                name='uq_admin_membership_active_user_role',
            ),
            models.UniqueConstraint(
                fields=['user'],
                condition=models.Q(is_primary=True, is_active=True),
                name='uq_admin_membership_active_primary',
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
