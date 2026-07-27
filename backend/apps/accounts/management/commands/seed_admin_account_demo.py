from django.conf import settings
from django.contrib.auth.hashers import make_password
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from apps.accounts.models import (
    AdminMembership,
    AdminPermission,
    AdminRole,
    Department,
    User,
)
from apps.accounts.services import (
    assign_membership,
    create_provisioning_scope,
    record_admin_action,
    set_role_permissions,
    sync_permission_catalog,
)

DEMO_PASSWORD = 'AdminDemo123!'
DEMO_ACCOUNTS = (
    {
        'email': 'admin-root@demo.local',
        'name': 'Superuser Demo',
        'is_superuser': True,
        'role_code': None,
        'backup_codes': ('91000001', '91000002', '91000003', '91000004', '91000005'),
    },
    {
        'email': 'hr-provisioner@demo.local',
        'name': 'Nhân sự cấp tài khoản',
        'is_superuser': False,
        'role_code': 'internal-hr',
        'backup_codes': ('92000001', '92000002', '92000003', '92000004', '92000005'),
    },
    {
        'email': 'moderator-admin@demo.local',
        'name': 'Nhân viên kiểm duyệt',
        'is_superuser': False,
        'role_code': 'moderator',
        'backup_codes': ('93000001', '93000002', '93000003', '93000004', '93000005'),
    },
)

ROLE_DEFINITIONS = (
    {
        'code': 'internal-hr',
        'name': 'Nhân sự nội bộ',
        'description': 'Được mời Admin vào các chức danh đã whitelist.',
        'permissions': (
            'dashboard.view',
            'admin_access.view',
            'account.admin.invite',
        ),
    },
    {
        'code': 'moderator',
        'name': 'Nhân viên kiểm duyệt',
        'description': 'Kiểm duyệt tin tuyển dụng.',
        'permissions': (
            'dashboard.view',
            'job_moderation.view',
            'job_moderation.approve',
            'job_moderation.reject',
            'job_moderation.resolve_report',
        ),
    },
    {
        'code': 'content',
        'name': 'Nhân viên nội dung',
        'description': 'Quản lý nội dung trong phạm vi được giao.',
        'permissions': (
            'dashboard.view',
            'blog.view',
            'blog.manage',
        ),
    },
    {
        'code': 'customer-care',
        'name': 'Nhân viên chăm sóc khách hàng',
        'description': 'Theo dõi và xử lý lead tư vấn.',
        'permissions': (
            'dashboard.view',
            'consultation_lead.view',
            'consultation_lead.manage',
        ),
    },
)


class Command(BaseCommand):
    help = 'Tạo tài khoản và whitelist demo Account Management G3 cho Docker local.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--force',
            action='store_true',
            help='Cho phép chạy ngoài DEBUG (không khuyến nghị).',
        )

    def handle(self, *args, **options):
        if not settings.DEBUG and not options['force']:
            raise CommandError(
                'Seed demo chỉ được chạy khi DEBUG=True. Dùng --force nếu đã hiểu rủi ro.'
            )

        with transaction.atomic():
            sync_permission_catalog(source='seed', actor_identifier='seed_admin_account_demo')
            root = self._upsert_account(DEMO_ACCOUNTS[0])
            department, _ = Department.objects.update_or_create(
                code='people-operations',
                defaults={
                    'name': 'Vận hành nhân sự',
                    'description': 'Phòng ban demo cho luồng cấp tài khoản Admin G3.',
                    'is_active': True,
                    'is_system_managed': False,
                },
            )
            roles = self._upsert_roles(department, root)
            for definition in DEMO_ACCOUNTS[1:]:
                user = self._upsert_account(definition)
                desired_role = roles[definition['role_code']]
                current_role_id = (
                    AdminMembership.objects.filter(user=user, is_active=True)
                    .values_list('role_id', flat=True)
                    .first()
                )
                if current_role_id != desired_role.pk:
                    assign_membership(
                        user,
                        desired_role,
                        actor=root,
                        source='seed',
                        actor_identifier='seed_admin_account_demo',
                    )
            for target_code in ('moderator', 'content', 'customer-care'):
                create_provisioning_scope(
                    source_role=roles['internal-hr'],
                    target_role=roles[target_code],
                    actor=root,
                )

        self.stdout.write(self.style.SUCCESS('Đã đồng bộ demo Account Management G3.'))
        self.stdout.write(f'Mật khẩu chung: {DEMO_PASSWORD}')
        for definition in DEMO_ACCOUNTS:
            kind = (
                'Superuser' if definition['is_superuser'] else roles[definition['role_code']].name
            )
            self.stdout.write(
                f'- {definition["email"]} | {kind} | mã dự phòng: '
                f'{", ".join(definition["backup_codes"])}'
            )

    def _upsert_account(self, definition):
        user, created = User.objects.get_or_create(
            email=definition['email'],
            role=User.Role.ADMIN,
            defaults={'full_name': definition['name']},
        )
        user.full_name = definition['name']
        user.status = User.Status.ACTIVE
        user.is_active = True
        user.is_staff = definition['is_superuser']
        user.is_superuser = definition['is_superuser']
        user.email_verified = True
        user.two_factor_enabled = True
        user.two_factor_email_enabled = True
        user.two_factor_backup_code_hashes = [
            make_password(code) for code in definition['backup_codes']
        ]
        user.set_password(DEMO_PASSWORD)
        user.save(
            update_fields=[
                'full_name',
                'status',
                'is_active',
                'is_staff',
                'is_superuser',
                'email_verified',
                'two_factor_enabled',
                'two_factor_email_enabled',
                'two_factor_backup_code_hashes',
                'password',
                'updated_at',
            ]
        )
        if created:
            record_admin_action(
                actor=None,
                source='seed',
                actor_identifier='seed_admin_account_demo',
                action='create_admin_demo_user',
                target_type='user',
                target_public_id=user.public_id,
                payload={
                    'user_public_id': user.public_id,
                    'email': user.email,
                    'is_superuser': user.is_superuser,
                },
            )
        return user

    def _upsert_roles(self, department, root):
        active_permissions = {
            item.code: item for item in AdminPermission.objects.filter(is_active=True)
        }
        roles = {}
        for index, definition in enumerate(ROLE_DEFINITIONS, start=1):
            role, _ = AdminRole.objects.update_or_create(
                department=department,
                code=definition['code'],
                defaults={
                    'name': definition['name'],
                    'description': definition['description'],
                    'rank': index * 10,
                    'is_active': True,
                    'is_system_managed': False,
                },
            )
            set_role_permissions(
                role,
                {code for code in definition['permissions'] if code in active_permissions},
                actor=root,
                source='seed',
                actor_identifier='seed_admin_account_demo',
            )
            roles[definition['code']] = role
        return roles
