from rest_framework import status
from rest_framework.exceptions import APIException


class CandidateUploadSessionRequiredResponse(APIException):
    status_code = status.HTTP_409_CONFLICT
    default_code = 'UPLOAD_SESSION_REQUIRED'
    default_detail = {
        'code': default_code,
        'message': 'Tệp phải hoàn tất upload session và quét an toàn trước khi gửi.',
        'retryable': False,
    }


class CandidateUploadSessionResponse(APIException):
    """Preserve safe shared-upload codes at the candidate CV boundary."""

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
