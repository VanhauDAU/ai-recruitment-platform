import os

from django.core.management.base import CommandError

from apps.accounts.models import User


def resolve_actor(email):
    if not email:
        return None
    try:
        return User.objects.get(email__iexact=email, role=User.Role.ADMIN)
    except User.DoesNotExist as error:
        raise CommandError(f'Không tìm thấy tài khoản admin actor: {email}.') from error
    except User.MultipleObjectsReturned as error:
        raise CommandError(f'Actor không duy nhất: {email}.') from error


def cli_actor_identifier():
    return f'cli:{os.getenv("USER", "unknown")}'
