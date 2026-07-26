"""Signed, versioned tokens for administrator invitations."""

from django.core import signing

TOKEN_SALT = 'admin-account-invitation'


class InvalidAdminInvitationToken(ValueError):
    pass


def create_admin_invitation_token(invitation):
    return signing.dumps(
        {'invitation': invitation.public_id, 'version': invitation.token_version},
        salt=TOKEN_SALT,
        compress=True,
    )


def decode_admin_invitation_token(token):
    try:
        payload = signing.loads(token, salt=TOKEN_SALT)
    except (signing.BadSignature, TypeError, ValueError) as error:
        raise InvalidAdminInvitationToken('Liên kết mời không hợp lệ.') from error
    if (
        not isinstance(payload, dict)
        or not isinstance(payload.get('invitation'), str)
        or not isinstance(payload.get('version'), int)
    ):
        raise InvalidAdminInvitationToken('Liên kết mời không hợp lệ.')
    return payload
