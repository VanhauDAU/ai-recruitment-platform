from django.core.management.base import BaseCommand, CommandError

from apps.accounts.constants import ADMIN_DEPARTMENTS
from apps.accounts.models import AdminPermission, AdminRole, Department, User
from apps.accounts.services import (
    assign_membership,
    set_role_permissions,
    update_system_department_metadata,
    update_system_role_metadata,
)

from ._admin_access import cli_actor_identifier, resolve_actor


class Command(BaseCommand):
    help = 'Seed hội tụ phòng ban/chức danh hệ thống và tuỳ chọn gán admin hiện có.'

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

        for definition in ADMIN_DEPARTMENTS:
            department, created = Department.objects.get_or_create(
                code=definition['code'],
                defaults={
                    'name': definition['name'],
                    'description': definition['description'],
                    'is_system_managed': True,
                },
            )
            if not created and department.is_system_managed:
                department = update_system_department_metadata(
                    department,
                    name=definition['name'],
                    description=definition['description'],
                    actor=actor,
                    source=source,
                    actor_identifier=actor_identifier,
                )
            elif not created:
                self.stdout.write(
                    f'Phòng ban {department.code} đã tuỳ chỉnh qua UI — bỏ qua metadata.'
                )
            for role_definition in definition['roles']:
                role, role_created = AdminRole.objects.get_or_create(
                    department=department,
                    code=role_definition['code'],
                    defaults={
                        'name': role_definition['name'],
                        'description': role_definition.get('description', ''),
                        'rank': role_definition['rank'],
                        'is_system_managed': True,
                    },
                )
                if not role_created and role.is_system_managed:
                    role = update_system_role_metadata(
                        role,
                        name=role_definition['name'],
                        description=role_definition.get('description', ''),
                        rank=role_definition['rank'],
                        actor=actor,
                        source=source,
                        actor_identifier=actor_identifier,
                    )
                elif not role_created:
                    self.stdout.write(f'Role {role} đã tuỳ chỉnh qua UI — bỏ qua.')
                    continue
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
        self.stdout.write(self.style.SUCCESS('Đã đồng bộ ma trận phân quyền admin hệ thống.'))
