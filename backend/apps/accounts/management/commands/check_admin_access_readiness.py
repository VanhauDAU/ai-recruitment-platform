from collections import Counter

from django.core.management.base import BaseCommand, CommandError

from apps.accounts.models import AdminMembership, AdminRole, User


class Command(BaseCommand):
    help = 'Hard gate xác nhận dữ liệu RBAC sẵn sàng trước khi phát hành G1.2.'

    def handle(self, *args, **options):
        errors = []
        admins = User.objects.filter(role=User.Role.ADMIN, is_superuser=False)
        for user in admins:
            memberships = AdminMembership.objects.filter(user=user, is_active=True)
            valid = memberships.filter(
                role__is_active=True,
                role__department__is_active=True,
            )
            if not valid.exists():
                errors.append(f'{user.email}: không có active membership hiệu lực.')
                continue
            effective = valid.filter(role__permissions__is_active=True).exists()
            if not effective:
                errors.append(f'{user.email}: membership không sinh permission hiệu dụng.')

        invalid_primaries = AdminMembership.objects.filter(
            is_active=True,
            is_primary=True,
        ).exclude(role__is_active=True, role__department__is_active=True)
        for membership in invalid_primaries.select_related('user', 'role__department'):
            errors.append(
                f'{membership.user.email}: primary trỏ vào {membership.role} đang bị khoá.'
            )

        primary_counts = Counter(
            AdminMembership.objects.filter(is_active=True, is_primary=True).values_list(
                'user_id', flat=True
            )
        )
        duplicate_ids = [user_id for user_id, count in primary_counts.items() if count > 1]
        for user in User.objects.filter(pk__in=duplicate_ids):
            errors.append(f'{user.email}: có nhiều hơn một primary active.')

        deprecated_roles = AdminRole.objects.filter(permissions__is_active=False).distinct()
        for role in deprecated_roles.prefetch_related('permissions'):
            codes = sorted(
                permission.code for permission in role.permissions.all() if not permission.is_active
            )
            self.stdout.write(
                self.style.WARNING(
                    f'WARNING: {role} còn giữ permission deprecated: {", ".join(codes)}.'
                )
            )

        self.stdout.write(
            self.style.WARNING(
                'WARNING: Từ G1.2, site settings chỉ dành cho superuser. '
                'Hãy xác nhận các tài khoản vận hành hiện tại trước khi tiếp tục.'
            )
        )
        if errors:
            for error in errors:
                self.stdout.write(self.style.ERROR(f'ERROR: {error}'))
            raise CommandError(f'Readiness gate thất bại với {len(errors)} lỗi.')
        self.stdout.write(self.style.SUCCESS('Admin access readiness: OK.'))
