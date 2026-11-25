"""JWT issuance and revocation workflows."""

from datetime import UTC, datetime

from django.contrib.auth.models import update_last_login
from django.db import transaction
from django.utils.translation import gettext as _
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.settings import api_settings
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken
from rest_framework_simplejwt.tokens import AccessToken, RefreshToken
from rest_framework_simplejwt.utils import datetime_to_epoch

from ..models import User
from . import auth_sessions, cf_access
from .access import is_account_accessible
from .refresh_cookies import portal_for_user
from .session_policy import policy_for


def build_refresh_token(user):
    """Refresh token kèm claim role/email — nguồn sự thật duy nhất cho mọi luồng phát token."""
    token = RefreshToken.for_user(user)
    token['role'] = user.role
    token['email'] = user.email
    token[auth_sessions.AUTH_REVISION_CLAIM] = user.auth_revision
    return token


def issue_tokens(user, request=None, *, auth_method='password'):
    if user.is_admin_role:
        # Mọi luồng phát phiên admin (đăng nhập, đổi mật khẩu...) đều qua đây.
        cf_access.require_access(request)
    expected_revision = user.auth_revision
    with transaction.atomic():
        user = User.objects.select_for_update().get(pk=user.pk)
        if not is_account_accessible(user):
            raise AuthenticationFailed(_('Tài khoản không còn khả dụng.'))
        if user.auth_revision != expected_revision:
            raise AuthenticationFailed(_('Thông tin xác thực đã thay đổi. Vui lòng đăng nhập lại.'))
        update_last_login(None, user)
        refresh = build_refresh_token(user)
        # Tạo phiên thiết bị và gắn claim `sid` TRƯỚC khi serialize access/refresh.
        session = auth_sessions.start_session(user, refresh, request, auth_method=auth_method)
        # Refresh JWT hết hạn cùng lúc với phiên của cổng, không theo trần chung.
        refresh['exp'] = datetime_to_epoch(session.expires_at)
        access = refresh.access_token
        # ``access_token`` kế thừa ``iat`` của refresh. Dùng đúng mốc đó để hạn
        # access của cổng không bị lệch một giây khi qua boundary.
        access.set_exp(
            from_time=datetime.fromtimestamp(access['iat'], tz=UTC),
            lifetime=policy_for(user.role).access_lifetime,
        )
        return {'access': str(access), 'refresh': str(refresh)}


def revoke_refresh_tokens(user):
    for token in OutstandingToken.objects.filter(user=user):
        BlacklistedToken.objects.get_or_create(token=token)
    auth_sessions.mark_all_revoked(user)


def refresh_session_tokens(raw_refresh, *, portal, rotate):
    """Rotate a refresh token of a live device session; return simplejwt data plus ``user``.

    ``rotate`` runs simplejwt's own refresh (blacklist the old token, mint the new
    pair). It is called under the session row lock so one refresh token can only
    ever be rotated once.
    """
    try:
        refresh = RefreshToken(raw_refresh)
    except TokenError:
        # Chữ ký còn hợp lệ và chưa hết hạn mà vẫn bị từ chối nghĩa là token
        # đã bị blacklist khi xoay vòng — tức có người phát lại bản cũ.
        auth_sessions.revoke_reused_refresh(raw_refresh)
        raise
    user = User.objects.filter(pk=refresh.get(api_settings.USER_ID_CLAIM)).first()
    if not is_account_accessible(user):
        raise InvalidToken({'detail': _('Tài khoản không còn khả dụng.')})
    if portal and portal_for_user(user) != portal:
        raise InvalidToken({'detail': _('Refresh token không thuộc cổng này.')})
    auth_revision = refresh.get(auth_sessions.AUTH_REVISION_CLAIM, 1)
    if auth_revision != user.auth_revision:
        raise InvalidToken({'detail': _('Phiên đăng nhập đã bị thu hồi.')})
    old_jti = refresh.get(api_settings.JTI_CLAIM)
    with transaction.atomic():
        session = auth_sessions.locked_refresh_session(
            sid=refresh.get(auth_sessions.SID_CLAIM),
            user=user,
            refresh_jti=old_jti,
            auth_revision=auth_revision,
        )
        if session is not None:
            # The row lock serializes concurrent rotation of one refresh token.
            # The second request observes the old jti no longer attached to a
            # live session and is rejected instead of creating a second branch.
            data = rotate()
            if data.get('refresh'):
                # simplejwt đặt hạn token mới = now + trần chung; kéo về đúng
                # hạn tuyệt đối của phiên để xoay vòng không gia hạn phiên.
                rotated = RefreshToken(data['refresh'])
                rotated['exp'] = datetime_to_epoch(session.expires_at)
                data['refresh'] = str(rotated)
                auth_sessions.rotate_session(session, data['refresh'])

    if session is None:
        # Thu hồi PHẢI nằm ngoài atomic ở trên, nếu không exception bên dưới
        # sẽ rollback luôn chính việc thu hồi.
        auth_sessions.revoke_reused_refresh(raw_refresh)
        raise InvalidToken({'detail': _('Phiên đăng nhập đã hết hạn hoặc bị thu hồi.')})

    if data.get('access'):
        access = AccessToken(data['access'])
        access.set_exp(lifetime=policy_for(user.role).access_lifetime)
        data['access'] = str(access)
    data['user'] = user
    return data


def revoke_refresh(raw_refresh):
    """Blacklist one refresh token and end its device session; invalid tokens are ignored."""
    try:
        parsed = RefreshToken(raw_refresh)
        parsed.blacklist()
        auth_sessions.revoke_session_by_refresh_jti(parsed.get(api_settings.JTI_CLAIM))
    except TokenError:
        pass
