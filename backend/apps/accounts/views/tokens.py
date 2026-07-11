"""Helper phát/thu hồi JWT dùng chung giữa các nhóm view auth."""

from django.contrib.auth.models import update_last_login
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken

from ..serializers import RoleTokenObtainPairSerializer


def issue_tokens(user):
    """Trả về access/refresh JWT (kèm claim role/email) cho `user`.

    Dùng cho đăng ký (auto-login) và social login — 2 luồng phát JWT không đi
    qua `RoleTokenObtainPairSerializer` nên tự cập nhật `last_login` ở đây.
    """
    update_last_login(None, user)
    refresh = RoleTokenObtainPairSerializer.get_token(user)
    return {'access': str(refresh.access_token), 'refresh': str(refresh)}


def revoke_refresh_tokens(user):
    """Chặn mọi phiên đăng nhập cũ sau khi mật khẩu bị đổi.

    Access token vẫn sống tới khi hết hạn (SimpleJWT không kiểm tra blacklist cho
    access token), nhưng kẻ giữ refresh token cũ không gia hạn thêm được nữa.
    """
    for token in OutstandingToken.objects.filter(user=user):
        BlacklistedToken.objects.get_or_create(token=token)
