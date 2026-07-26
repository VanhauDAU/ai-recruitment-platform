import django.db.models.deletion
from django.core.management.color import no_style
from django.db import migrations, models


ACCOUNT_PERMISSIONS = (
    (
        'account.admin.invite',
        'Mời tài khoản quản trị',
        'Mời và quản lý lời mời quản trị viên trong phạm vi chức danh được cấp.',
    ),
    (
        'account.admin.manage',
        'Quản lý tài khoản quản trị',
        'Quản lý tài khoản quản trị đã kích hoạt; thao tác ghi vẫn superuser-only.',
    ),
    (
        'account.admin.view',
        'Xem tài khoản quản trị',
        'Xem danh sách và chi tiết tài khoản quản trị nội bộ.',
    ),
    (
        'account.profile.manage',
        'Sửa thông tin tài khoản',
        'Sửa họ tên và số điện thoại của ứng viên hoặc nhà tuyển dụng.',
    ),
    (
        'account.security.manage',
        'Hỗ trợ bảo mật tài khoản',
        'Gửi xác minh, đặt lại mật khẩu và thu hồi phiên tài khoản.',
    ),
    (
        'account.status.manage',
        'Quản lý trạng thái tài khoản',
        'Tạm khóa, mở khóa hoặc cấm tài khoản ứng viên và nhà tuyển dụng.',
    ),
    (
        'account.view',
        'Xem tài khoản người dùng',
        'Xem danh sách và chi tiết tài khoản ứng viên, nhà tuyển dụng.',
    ),
)


def seed_account_permissions(apps, schema_editor):
    permission_model = apps.get_model('accounts', 'AdminPermission')
    for code, label, description in ACCOUNT_PERMISSIONS:
        permission_model.objects.update_or_create(
            code=code,
            defaults={
                'module': 'account',
                'label': label,
                'description': description,
                'is_active': True,
                'deprecated_at': None,
            },
        )
    # PostgreSQL sequences are not advanced when a historical migration writes
    # explicit rows through an ORM model whose table already exists.
    for statement in schema_editor.connection.ops.sequence_reset_sql(
        no_style(),
        [permission_model],
    ):
        schema_editor.execute(statement)


def keep_account_permissions(apps, schema_editor):
    # Permission rows are audit-relevant configuration. A rollback must not
    # silently strip grants from roles; the catalog sync can deprecate them.
    return None


class Migration(migrations.Migration):
    dependencies = [('accounts', '0015_single_active_admin_membership')]

    operations = [
        migrations.AlterField(
            model_name='authemailjob',
            name='kind',
            field=models.CharField(
                choices=[
                    ('verification', 'Email verification'),
                    ('welcome', 'Welcome email'),
                    ('password_reset', 'Password reset'),
                    ('two_factor', 'Two-factor authentication code'),
                    ('admin_invitation', 'Admin invitation'),
                ],
                max_length=30,
            ),
        ),
        migrations.CreateModel(
            name='AdminProvisioningScope',
            fields=[
                (
                    'id',
                    models.BigAutoField(
                        auto_created=True, primary_key=True, serialize=False, verbose_name='ID'
                    ),
                ),
                ('public_id', models.CharField(editable=False, max_length=64, unique=True)),
                ('is_active', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                (
                    'configured_by',
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name='configured_admin_provisioning_scopes',
                        to='accounts.user',
                    ),
                ),
                (
                    'source_role',
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name='provisioning_scopes',
                        to='accounts.adminrole',
                    ),
                ),
                (
                    'target_role',
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name='provisioned_by_scopes',
                        to='accounts.adminrole',
                    ),
                ),
            ],
            options={
                'ordering': [
                    'source_role__department__name',
                    'source_role__name',
                    'target_role__name',
                ],
            },
        ),
        migrations.AddConstraint(
            model_name='adminprovisioningscope',
            constraint=models.UniqueConstraint(
                fields=('source_role', 'target_role'), name='uq_admin_provisioning_source_target'
            ),
        ),
        migrations.CreateModel(
            name='AdminInvitation',
            fields=[
                (
                    'id',
                    models.BigAutoField(
                        auto_created=True, primary_key=True, serialize=False, verbose_name='ID'
                    ),
                ),
                ('public_id', models.CharField(editable=False, max_length=64, unique=True)),
                (
                    'status',
                    models.CharField(
                        choices=[
                            ('pending', 'Pending'),
                            ('accepted', 'Accepted'),
                            ('revoked', 'Revoked'),
                            ('expired', 'Expired'),
                        ],
                        default='pending',
                        max_length=20,
                    ),
                ),
                ('reason', models.CharField(max_length=500)),
                ('token_version', models.PositiveIntegerField(default=1)),
                ('expires_at', models.DateTimeField()),
                ('accepted_at', models.DateTimeField(blank=True, null=True)),
                ('revoked_at', models.DateTimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                (
                    'invited_by',
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name='admin_invitations_sent',
                        to='accounts.user',
                    ),
                ),
                (
                    'provisioning_scope',
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name='admin_invitations',
                        to='accounts.adminprovisioningscope',
                    ),
                ),
                (
                    'target_role',
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name='admin_invitations',
                        to='accounts.adminrole',
                    ),
                ),
                (
                    'user',
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name='admin_invitations_received',
                        to='accounts.user',
                    ),
                ),
            ],
            options={
                'ordering': ['-created_at', '-id'],
                'indexes': [
                    models.Index(
                        fields=['status', 'expires_at'], name='admin_invite_status_exp_idx'
                    ),
                    models.Index(
                        fields=['invited_by', 'status'], name='admin_invite_actor_status_idx'
                    ),
                ],
            },
        ),
        migrations.AddConstraint(
            model_name='admininvitation',
            constraint=models.UniqueConstraint(
                condition=models.Q(('status', 'pending')),
                fields=('user',),
                name='uq_admin_invitation_pending_user',
            ),
        ),
        migrations.RunPython(seed_account_permissions, keep_account_permissions),
    ]
