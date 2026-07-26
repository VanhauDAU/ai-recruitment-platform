from rest_framework import status
from rest_framework.exceptions import APIException, PermissionDenied


class AdminPermissionDenied(PermissionDenied):
    def __init__(self, message='Bạn không có quyền thực hiện hành động này.'):
        super().__init__(
            detail={
                'code': 'admin_permission_denied',
                'message': message,
            }
        )


class AdminResourceChanged(APIException):
    status_code = status.HTTP_409_CONFLICT
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
