"""Views của app accounts, tách theo mối quan tâm (khớp các module service cùng tên):

- auth.py            — đăng ký, đăng nhập, me, avatar
- verification.py    — xác thực email (../services/email_verification.py)
- password_reset.py  — đặt lại mật khẩu (../services/password_reset.py)
- oauth.py           — social login (../oauth.py)
"""

from .auth import AvatarUploadView, LoginView, MeView, RegisterEmailAvailabilityView, RegisterView
from .logout import LogoutAllView, LogoutView
from .oauth import OAuthCallbackView, OAuthCompleteView, OAuthStartView
from .password import PasswordChangeView
from .password_reset import (
    PasswordResetConfirmView,
    PasswordResetRequestView,
    PasswordResetValidateView,
)
from .sessions import SessionListView, SessionRevokeOthersView, SessionRevokeView
from .verification import ChangeEmailView, VerificationConfirmView, VerificationSendView
from .two_factor import (
    TwoFactorDisableConfirmView,
    TwoFactorDisableSendView,
    EmployerBackupCodesGenerateView,
    EmployerBackupCodesSendView,
    EmployerTotpConfirmView,
    EmployerTotpDisableView,
    EmployerTotpSetupView,
    EmployerTwoFactorMethodDisableSendView,
    EmployerTwoFactorMethodDisableView,
    EmployerTwoFactorMethodsView,
    TwoFactorLoginResendView,
    TwoFactorLoginVerifyView,
    TwoFactorSetupConfirmView,
    TwoFactorSetupSendView,
)

__all__ = [
    'AvatarUploadView',
    'ChangeEmailView',
    'LoginView',
    'LogoutView',
    'LogoutAllView',
    'MeView',
    'OAuthCallbackView',
    'OAuthCompleteView',
    'OAuthStartView',
    'PasswordResetConfirmView',
    'PasswordChangeView',
    'PasswordResetRequestView',
    'PasswordResetValidateView',
    'RegisterView',
    'RegisterEmailAvailabilityView',
    'SessionListView',
    'SessionRevokeView',
    'SessionRevokeOthersView',
    'VerificationConfirmView',
    'VerificationSendView',
    'TwoFactorLoginResendView',
    'TwoFactorLoginVerifyView',
    'EmployerBackupCodesGenerateView',
    'EmployerBackupCodesSendView',
    'EmployerTotpConfirmView',
    'EmployerTotpDisableView',
    'EmployerTotpSetupView',
    'EmployerTwoFactorMethodDisableSendView',
    'EmployerTwoFactorMethodDisableView',
    'EmployerTwoFactorMethodsView',
    'TwoFactorDisableConfirmView',
    'TwoFactorDisableSendView',
    'TwoFactorSetupConfirmView',
    'TwoFactorSetupSendView',
]
