"""JWT issuance and revocation workflows."""

from django.contrib.auth.models import update_last_login
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken

from ..serializers import RoleTokenObtainPairSerializer
from .access import is_account_accessible


def issue_tokens(user):
    if not is_account_accessible(user):
        raise ValueError('Cannot issue tokens for an inaccessible account.')
    update_last_login(None, user)
    refresh = RoleTokenObtainPairSerializer.get_token(user)
    return {'access': str(refresh.access_token), 'refresh': str(refresh)}


def revoke_refresh_tokens(user):
    for token in OutstandingToken.objects.filter(user=user):
        BlacklistedToken.objects.get_or_create(token=token)
