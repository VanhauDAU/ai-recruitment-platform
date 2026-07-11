"""Views của app accounts, tách theo mối quan tâm (khớp các module service cùng tên):

- auth.py            — đăng ký, đăng nhập, me, avatar
- verification.py    — xác thực email (../email_verification.py)
- password_reset.py  — đặt lại mật khẩu (../password_reset.py)
- oauth.py           — social login (../oauth.py)
"""

from .auth import AvatarUploadView, LoginView, MeView, RegisterView
from .oauth import OAuthCallbackView, OAuthCompleteView, OAuthStartView
from .password_reset import (
    PasswordResetConfirmView,
    PasswordResetRequestView,
    PasswordResetValidateView,
)
from .verification import ChangeEmailView, VerificationConfirmView, VerificationSendView

__all__ = [
    'AvatarUploadView',
    'ChangeEmailView',
    'LoginView',
    'MeView',
    'OAuthCallbackView',
    'OAuthCompleteView',
    'OAuthStartView',
    'PasswordResetConfirmView',
    'PasswordResetRequestView',
    'PasswordResetValidateView',
    'RegisterView',
    'VerificationConfirmView',
    'VerificationSendView',
]
