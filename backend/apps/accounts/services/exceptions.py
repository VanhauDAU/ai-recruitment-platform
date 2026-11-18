from http import HTTPStatus

from rest_framework.exceptions import APIException, PermissionDenied

from common.errors import DomainError


class AdminPermissionDenied(PermissionDenied):
    def __init__(self, message='Bạn không có quyền thực hiện hành động này.'):
        super().__init__(
            detail={
                'code': 'admin_permission_denied',
                'message': message,
            }
        )


class AdminResourceChanged(APIException):
    status_code = HTTPStatus.CONFLICT
    default_code = 'admin_resource_changed'

    def __init__(
        self, message='Dữ liệu đã thay đổi. Vui lòng xem lại tác động trước khi tiếp tục.'
    ):
        super().__init__(
            detail={
                'code': 'admin_resource_changed',
                'message': message,
            }
        )


class VerificationCooldown(DomainError):
    """Gửi lại email xác thực khi cooldown chưa hết; client đếm ngược theo ``retry_after``."""

    status_code = HTTPStatus.TOO_MANY_REQUESTS
    code = 'verification_cooldown'

    def __init__(self, retry_after):
        super().__init__(f'Vui lòng chờ {retry_after}s trước khi gửi lại.')
        self.retry_after = retry_after

    def payload(self):
        return {'detail': str(self), 'retry_after': self.retry_after}


class OAuthReauthRequired(DomainError):
    """Tài khoản chỉ có đăng nhập mạng xã hội phải xác thực lại trước khi tạo mật khẩu."""

    status_code = HTTPStatus.FORBIDDEN
    code = 'reauth_required'

    def __init__(self, provider):
        super().__init__('Hãy xác thực lại bằng mạng xã hội trước khi tạo mật khẩu.')
        self.provider = provider

    def payload(self):
        return {'detail': str(self), 'code': self.code, 'reauth_provider': self.provider}
