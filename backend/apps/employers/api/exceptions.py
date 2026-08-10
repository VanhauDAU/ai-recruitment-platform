from rest_framework import status
from rest_framework.exceptions import APIException


class CompanyTaxCodeConflictResponse(APIException):
    status_code = status.HTTP_409_CONFLICT
    default_code = 'company_tax_code_conflict'

    def __init__(self, tax_code, *, claim_status):
        if claim_status == 'verified':
            message = (
                f'Mã số thuế {tax_code} đã thuộc một công ty được xác thực. '
                'Không thể duyệt hồ sơ này.'
            )
        else:
            message = (
                f'Mã số thuế {tax_code} vừa được xác thực cho một công ty khác. '
                'Vui lòng tải lại và kiểm tra trước khi duyệt.'
            )
        super().__init__(
            detail={
                'code': self.default_code,
                'message': message,
            }
        )


class CompanyUpdateConflictResponse(APIException):
    status_code = status.HTTP_409_CONFLICT
    default_code = 'company_update_base_conflict'

    def __init__(self, fields):
        super().__init__(
            detail={
                'code': self.default_code,
                'message': (
                    'Thông tin công ty đã thay đổi ở các trường đang được yêu cầu cập nhật. '
                    'Vui lòng tải lại và tạo revision mới.'
                ),
                'conflicting_fields': list(fields),
            }
        )


class UploadPreviewScanRequiredResponse(APIException):
    """Block raw Office conversion until upload-session trust exists."""

    status_code = status.HTTP_409_CONFLICT
    default_code = 'UPLOAD_SCAN_REQUIRED'
    default_detail = {
        'code': default_code,
        'message': (
            'Bản xem trước DOC/DOCX chỉ khả dụng sau khi tệp đã được quét an toàn. '
            'Vui lòng tải tệp lên khi luồng quét được bật.'
        ),
    }


class UploadSessionRequiredResponse(APIException):
    status_code = status.HTTP_409_CONFLICT
    default_code = 'UPLOAD_SESSION_REQUIRED'
    default_detail = {
        'code': default_code,
        'message': 'Tệp phải hoàn tất upload session và quét an toàn trước khi gửi.',
        'retryable': False,
    }


class DpaPolicyChangedResponse(APIException):
    status_code = status.HTTP_409_CONFLICT
    default_code = 'DPA_POLICY_CHANGED'
    default_detail = {
        'code': default_code,
        'message': 'DPA đã thay đổi. Vui lòng tải lại và đọc phiên bản mới nhất.',
        'retryable': True,
    }


class DpaPolicyUnavailableResponse(APIException):
    status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    default_code = 'DPA_POLICY_UNAVAILABLE'
    default_detail = {
        'code': default_code,
        'message': 'DPA hiện hành chưa sẵn sàng. Vui lòng thử lại sau.',
        'retryable': True,
    }


class EmployerUploadSessionResponse(APIException):
    """Preserve safe shared-upload codes at an employer business boundary."""

    default_code = 'UPLOAD_INVALID_STATE'

    def __init__(self, error):
        self.status_code = {
            'RESOURCE_NOT_FOUND': status.HTTP_404_NOT_FOUND,
            'UPLOAD_PIPELINE_DISABLED': status.HTTP_503_SERVICE_UNAVAILABLE,
            'UPLOAD_EXPIRED': status.HTTP_409_CONFLICT,
            'UPLOAD_NOT_CLEAN': status.HTTP_409_CONFLICT,
            'UPLOAD_PURPOSE_MISMATCH': status.HTTP_409_CONFLICT,
            'UPLOAD_ALREADY_SUBMITTED': status.HTTP_409_CONFLICT,
        }.get(error.code, status.HTTP_400_BAD_REQUEST)
        super().__init__(
            detail={
                'code': error.code,
                'message': error.message,
                'retryable': error.retryable,
            },
            code=error.code,
        )
