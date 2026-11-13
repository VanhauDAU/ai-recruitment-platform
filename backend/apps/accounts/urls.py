from django.urls import path

from .api.views import (
    AvatarUploadView,
    ChangeEmailView,
    LoginView,
    LogoutAllView,
    LogoutView,
    MeView,
    OAuthCallbackView,
    OAuthCompleteView,
    OAuthStartView,
    PasswordChangeView,
    PasswordResetConfirmView,
    PasswordResetRequestView,
    PasswordResetValidateView,
    RegisterEmailAvailabilityView,
    RegisterView,
    SessionListView,
    SessionRevokeOthersView,
    SessionRevokeView,
    VerificationConfirmView,
    VerificationSendView,
)
from .api.views.account_management import (
    AdminInvitationAcceptView,
    AdminInvitationValidateView,
)
from .api.views.tokens import AccountTokenRefreshView

urlpatterns = [
    path(
        'admin-invitations/validate/',
        AdminInvitationValidateView.as_view(),
        name='auth-admin-invitation-validate',
    ),
    path(
        'admin-invitations/accept/',
        AdminInvitationAcceptView.as_view(),
        name='auth-admin-invitation-accept',
    ),
    path('register/', RegisterView.as_view(), name='auth-register'),
    path(
        'register/email-availability/',
        RegisterEmailAvailabilityView.as_view(),
        name='auth-register-email-availability',
    ),
    path('login/', LoginView.as_view(), name='auth-login'),
    path('logout/', LogoutView.as_view(), name='auth-logout'),
    path('logout-all/', LogoutAllView.as_view(), name='auth-logout-all'),
    path('sessions/', SessionListView.as_view(), name='auth-sessions'),
    path(
        'sessions/revoke-others/',
        SessionRevokeOthersView.as_view(),
        name='auth-sessions-revoke-others',
    ),
    path('sessions/<uuid:session_id>/', SessionRevokeView.as_view(), name='auth-session-revoke'),
    path('refresh/', AccountTokenRefreshView.as_view(), name='auth-refresh'),
    path('me/', MeView.as_view(), name='auth-me'),
    path('avatar/', AvatarUploadView.as_view(), name='auth-avatar-upload'),
    path('verify/send/', VerificationSendView.as_view(), name='auth-verify-send'),
    path('verify/confirm/', VerificationConfirmView.as_view(), name='auth-verify-confirm'),
    path('change-email/', ChangeEmailView.as_view(), name='auth-change-email'),
    path('password-reset/', PasswordResetRequestView.as_view(), name='auth-password-reset'),
    path(
        'password-reset/validate/',
        PasswordResetValidateView.as_view(),
        name='auth-password-reset-validate',
    ),
    path(
        'password-reset/confirm/',
        PasswordResetConfirmView.as_view(),
        name='auth-password-reset-confirm',
    ),
    path('password/', PasswordChangeView.as_view(), name='auth-password-change'),
    path('oauth/<str:provider>/start/', OAuthStartView.as_view(), name='auth-oauth-start'),
    path('oauth/<str:provider>/callback/', OAuthCallbackView.as_view(), name='auth-oauth-callback'),
    path('oauth/complete/', OAuthCompleteView.as_view(), name='auth-oauth-complete'),
]
