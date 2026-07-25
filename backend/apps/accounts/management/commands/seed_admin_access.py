from django.core.management.base import BaseCommand, CommandError

from apps.accounts.models import AdminPermission, AdminRole, Department, User
from apps.accounts.services import assign_membership, set_role_permissions

from ._admin_access import cli_actor_identifier, resolve_actor

DEPARTMENTS = (
    {
        'code': 'content-cv',
        'name': 'Nội dung & CV',
        'description': 'Quản lý nội dung và catalogue mẫu CV.',
        'roles': (
            {
                'code': 'staff',
                'name': 'Nhân viên',
                'rank': 10,
                'permissions': (
                    'dashboard.view',
                    'cv_template.view',
                    'cv_template.create',
                    'cv_template.edit',
                ),
            },
            {
                'code': 'manager',
                'name': 'Trưởng phòng',
                'rank': 100,
                'permissions': (
                    'dashboard.view',
                    'cv_template.view',
                    'cv_template.create',
                    'cv_template.edit',
                    'cv_template.publish',
                    'cv_template.archive',
                    'cv_template.delete',
                ),
            },
        ),
    },
    {
        'code': 'job-moderation',
        'name': 'Kiểm duyệt tin tuyển dụng',
        'description': 'Kiểm tra và quyết định tin tuyển dụng được phép hiển thị.',
        'roles': (
            {
                'code': 'staff',
                'name': 'Nhân viên',
                'rank': 10,
                'permissions': (
                    'dashboard.view',
                    'job_moderation.view',
                    'job_moderation.approve',
                    'job_moderation.reject',
                ),
            },
            {
                'code': 'manager',
                'name': 'Trưởng phòng',
                'rank': 100,
                'permissions': (
                    'dashboard.view',
                    'job_moderation.view',
                    'job_moderation.approve',
                    'job_moderation.reject',
                ),
            },
        ),
    },
    {
        'code': 'employer-services',
        'name': 'Dịch vụ nhà tuyển dụng',
        'description': 'Quản lý dịch vụ và lead tư vấn của nhà tuyển dụng.',
        'roles': (
            {
                'code': 'staff',
                'name': 'Nhân viên',
                'rank': 10,
                'permissions': (
                    'dashboard.view',
                    'service_catalog.view',
                    'consultation_lead.view',
                    'consultation_lead.manage',
                ),
            },
            {
                'code': 'manager',
                'name': 'Trưởng phòng',
                'rank': 100,
                'permissions': (
                    'dashboard.view',
                    'service_catalog.view',
                    'service_catalog.manage',
                    'consultation_lead.view',
                    'consultation_lead.manage',
                ),
            },
        ),
    },
)


class Command(BaseCommand):
    help = 'Seed hội tụ phòng ban/chức danh G1 và tuỳ chọn gán admin hiện có.'

    def add_arguments(self, parser):
        parser.add_argument('--actor-email')
        parser.add_argument(
            '--assign',
            action='append',
            default=[],
            metavar='EMAIL:DEPARTMENT:ROLE',
        )

    def handle(self, *args, **options):
        if options['assign'] and not options['actor_email']:
            raise CommandError('--actor-email là bắt buộc khi dùng --assign.')
        actor = resolve_actor(options['actor_email'])
        active_codes = set(
            AdminPermission.objects.filter(is_active=True).values_list('code', flat=True)
        )
        if not active_codes:
            raise CommandError('Permission catalog trống. Hãy chạy sync_admin_permissions trước.')
        source = 'management_command' if actor else 'seed'
        actor_identifier = '' if actor else cli_actor_identifier()

        for definition in DEPARTMENTS:
            department, _ = Department.objects.update_or_create(
                code=definition['code'],
                defaults={
                    'name': definition['name'],
                    'description': definition['description'],
                    'is_active': True,
                },
            )
            for role_definition in definition['roles']:
                role, _ = AdminRole.objects.update_or_create(
                    department=department,
                    code=role_definition['code'],
                    defaults={
                        'name': role_definition['name'],
                        'rank': role_definition['rank'],
                        'is_active': True,
                    },
                )
                desired = set(role_definition['permissions']) & active_codes
                set_role_permissions(
                    role,
                    desired,
                    actor=actor,
                    source=source,
                    actor_identifier=actor_identifier,
                    preserve_deprecated=True,
                )

        for assignment in options['assign']:
            try:
                email, department_code, role_code = assignment.rsplit(':', 2)
                user = User.objects.get(email__iexact=email, role=User.Role.ADMIN)
                role = AdminRole.objects.get(
                    department__code=department_code,
                    code=role_code,
                )
            except (ValueError, User.DoesNotExist, AdminRole.DoesNotExist) as error:
                raise CommandError(f'Assignment không hợp lệ: {assignment}.') from error
            assign_membership(
                user,
                role,
                actor=actor,
                source='management_command',
            )
        self.stdout.write(self.style.SUCCESS('Đã đồng bộ ma trận phân quyền admin G1.'))
