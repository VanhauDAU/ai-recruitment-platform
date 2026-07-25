from rest_framework.exceptions import PermissionDenied


class AdminPermissionDenied(PermissionDenied):
    def __init__(self, message='Bạn không có quyền thực hiện hành động này.'):
        super().__init__(
            detail={
                'code': 'admin_permission_denied',
                'message': message,
            }
        )
