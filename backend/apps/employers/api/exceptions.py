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
