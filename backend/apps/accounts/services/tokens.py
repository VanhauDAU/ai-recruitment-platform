"""JWT issuance and revocation workflows."""

from datetime import datetime, timedelta, timezone

from django.conf import settings
from django.contrib.auth.models import update_last_login
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken

from ..serializers import RoleTokenObtainPairSerializer
from . import auth_sessions
from .access import is_account_accessible


def issue_tokens(user, request=None, *, auth_method='password'):
    if not is_account_accessible(user):
        raise ValueError('Cannot issue tokens for an inaccessible account.')
    update_last_login(None, user)
    refresh = RoleTokenObtainPairSerializer.get_token(user)
    # Tạo phiên thiết bị và gắn claim `sid` TRƯỚC khi serialize access/refresh.
    auth_sessions.start_session(user, refresh, request, auth_method=auth_method)
    access = refresh.access_token
    if user.is_admin_role:
        # ``access_token`` kế thừa ``iat`` của refresh. Dùng đúng mốc đó để
        # thời hạn 5 phút của admin không bị lệch một giây khi qua boundary.
        access.set_exp(
            from_time=datetime.fromtimestamp(access['iat'], tz=timezone.utc),
            lifetime=timedelta(minutes=settings.ADMIN_ACCESS_TOKEN_MINUTES),
        )
    return {'access': str(access), 'refresh': str(refresh)}


def revoke_refresh_tokens(user):
    for token in OutstandingToken.objects.filter(user=user):
        BlacklistedToken.objects.get_or_create(token=token)
    auth_sessions.mark_all_revoked(user)
