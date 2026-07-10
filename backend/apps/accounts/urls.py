from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from .views import (
    AvatarUploadView,
    ChangeEmailView,
    LoginView,
    MeView,
    OAuthCallbackView,
    OAuthCompleteView,
    OAuthStartView,
    PasswordResetConfirmView,
    PasswordResetRequestView,
    PasswordResetValidateView,
    RegisterView,
    VerificationConfirmView,
    VerificationSendView,
)

urlpatterns = [
    path('register/', RegisterView.as_view(), name='auth-register'),
    path('login/', LoginView.as_view(), name='auth-login'),
    path('refresh/', TokenRefreshView.as_view(), name='auth-refresh'),
    path('me/', MeView.as_view(), name='auth-me'),
    path('avatar/', AvatarUploadView.as_view(), name='auth-avatar-upload'),
    path('verify/send/', VerificationSendView.as_view(), name='auth-verify-send'),
    path('verify/confirm/', VerificationConfirmView.as_view(), name='auth-verify-confirm'),
    path('change-email/', ChangeEmailView.as_view(), name='auth-change-email'),
    path('password-reset/', PasswordResetRequestView.as_view(), name='auth-password-reset'),
    path('password-reset/validate/', PasswordResetValidateView.as_view(), name='auth-password-reset-validate'),
    path('password-reset/confirm/', PasswordResetConfirmView.as_view(), name='auth-password-reset-confirm'),
    path('oauth/<str:provider>/start/', OAuthStartView.as_view(), name='auth-oauth-start'),
    path('oauth/<str:provider>/callback/', OAuthCallbackView.as_view(), name='auth-oauth-callback'),
    path('oauth/complete/', OAuthCompleteView.as_view(), name='auth-oauth-complete'),
]
