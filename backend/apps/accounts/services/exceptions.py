from http import HTTPStatus

from django.utils.translation import gettext as _
from rest_framework.exceptions import APIException, PermissionDenied

from common.errors import DomainError


class AdminPermissionDenied(PermissionDenied):
    def __init__(self, message=None):
        super().__init__(
            detail={
                'code': 'admin_permission_denied',
                'message': message or _('Bạn không có quyền thực hiện hành động này.'),
            }
        )


class AdminResourceChanged(APIException):
    status_code = HTTPStatus.CONFLICT
    default_code = 'admin_resource_changed'

    def __init__(self, message=None):
        super().__init__(
            detail={
                'code': 'admin_resource_changed',
                'message': message
                or _('Dữ liệu đã thay đổi. Vui lòng xem lại tác động trước khi tiếp tục.'),
            }
        )


class VerificationCooldown(DomainError):
    """Gửi lại email xác thực khi cooldown chưa hết; client đếm ngược theo ``retry_after``."""

    status_code = HTTPStatus.TOO_MANY_REQUESTS
    code = 'verification_cooldown'

    def __init__(self, retry_after):
        super().__init__(
            _('Vui lòng chờ %(seconds)ss trước khi gửi lại.') % {'seconds': retry_after}
        )
        self.retry_after = retry_after

    def payload(self):
        return {'detail': str(self), 'retry_after': self.retry_after}


class PasswordSetupCodeCooldown(DomainError):
    """Gửi lại mã tạo mật khẩu khi cooldown chưa hết; client đếm ngược theo ``retry_after``."""

    status_code = HTTPStatus.TOO_MANY_REQUESTS
    code = 'password_setup_code_cooldown'

    def __init__(self, retry_after):
        super().__init__(
            _('Vui lòng chờ %(seconds)ss trước khi gửi lại mã.') % {'seconds': retry_after}
        )
        self.retry_after = retry_after

    def payload(self):
        return {'detail': str(self), 'code': self.code, 'retry_after': self.retry_after}


class RegistrationClosed(DomainError):
    """Quản trị viên đang tạm dừng tạo tài khoản mới cho cổng này."""

    status_code = HTTPStatus.FORBIDDEN
    code = 'registration_closed'

    def __init__(self):
        super().__init__(_('Hệ thống đang tạm dừng đăng ký tài khoản mới. Vui lòng quay lại sau.'))
