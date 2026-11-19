from http import HTTPStatus

from common.api.exceptions import DomainError

# Mã lỗi không có ở đây là lỗi dữ liệu đầu vào -> 400.
_HTTP_STATUS = {
    'RESOURCE_NOT_FOUND': HTTPStatus.NOT_FOUND,
    'UPLOAD_PURPOSE_FORBIDDEN': HTTPStatus.FORBIDDEN,
    'UPLOAD_PIPELINE_DISABLED': HTTPStatus.SERVICE_UNAVAILABLE,
    'UPLOAD_STORAGE_FAILED': HTTPStatus.SERVICE_UNAVAILABLE,
    'UPLOAD_TOO_LARGE': HTTPStatus.REQUEST_ENTITY_TOO_LARGE,
    'UPLOAD_SESSION_QUOTA_EXCEEDED': HTTPStatus.TOO_MANY_REQUESTS,
    'UPLOAD_BYTE_QUOTA_EXCEEDED': HTTPStatus.TOO_MANY_REQUESTS,
    'UPLOAD_BUSY': HTTPStatus.CONFLICT,
    'UPLOAD_EXPIRED': HTTPStatus.CONFLICT,
    'UPLOAD_INVALID_STATE': HTTPStatus.CONFLICT,
    'UPLOAD_NOT_CLEAN': HTTPStatus.CONFLICT,
    'UPLOAD_SCAN_FAILED': HTTPStatus.CONFLICT,
    'UPLOAD_ALREADY_SUBMITTED': HTTPStatus.CONFLICT,
}


class UploadServiceError(DomainError):
    """Machine-readable domain error whose message is safe for an API response."""

    def __init__(self, code, message, *, retryable=False):
        self.code = code
        self.message = message
        self.retryable = retryable
        super().__init__(code)

    @property
    def status_code(self):
        return _HTTP_STATUS.get(self.code, HTTPStatus.BAD_REQUEST)

    def payload(self):
        return {'code': self.code, 'message': self.message, 'retryable': self.retryable}


def upload_error(code, *, retryable=False):
    messages = {
        'RESOURCE_NOT_FOUND': 'Không tìm thấy upload session.',
        'UPLOAD_PIPELINE_DISABLED': 'Luồng tải tệp an toàn chưa sẵn sàng.',
        'UPLOAD_PURPOSE_NOT_ALLOWED': 'Mục đích tải tệp không được hỗ trợ.',
        'UPLOAD_PURPOSE_FORBIDDEN': 'Tài khoản không được phép dùng mục đích tải tệp này.',
        'UPLOAD_PURPOSE_MISMATCH': 'Tệp không thuộc đúng mục đích nghiệp vụ.',
        'UPLOAD_INVALID_METADATA': 'Thông tin tệp tải lên không hợp lệ.',
        'UPLOAD_TOO_LARGE': 'Tệp vượt quá dung lượng cho phép.',
        'UPLOAD_SESSION_QUOTA_EXCEEDED': 'Đã đạt giới hạn upload session đang hoạt động.',
        'UPLOAD_BYTE_QUOTA_EXCEEDED': 'Đã đạt giới hạn dung lượng upload đang hoạt động.',
        'UPLOAD_TYPE_NOT_ALLOWED': 'Định dạng tệp không được hỗ trợ.',
        'UPLOAD_CONTENT_MISMATCH': 'Nội dung tệp không khớp định dạng đã khai báo.',
        'UPLOAD_INVALID_STATE': 'Upload session không ở trạng thái phù hợp.',
        'UPLOAD_BUSY': 'Upload session đang được xử lý.',
        'UPLOAD_EXPIRED': 'Upload session đã hết hạn.',
        'UPLOAD_NOT_CLEAN': 'Tệp chưa vượt qua kiểm tra an toàn.',
        'UPLOAD_SCAN_FAILED': 'Không thể xác nhận tệp an toàn.',
        'UPLOAD_ALREADY_SUBMITTED': 'Tệp đã được sử dụng cho một lần gửi khác.',
        'UPLOAD_NOT_RELEASED': 'Tệp vẫn đang được nghiệp vụ sử dụng.',
        'UPLOAD_STORAGE_FAILED': 'Không thể lưu tệp an toàn.',
    }
    return UploadServiceError(code, messages[code], retryable=retryable)
