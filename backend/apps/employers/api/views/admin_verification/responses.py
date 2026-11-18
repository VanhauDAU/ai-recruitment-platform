"""OpenAPI error responses shared by the verification decision and lifecycle actions."""

from drf_spectacular.utils import OpenApiExample, OpenApiResponse, PolymorphicProxySerializer

from ...serializers.admin_verification import (
    AdminVerificationDecisionFieldErrorSerializer,
    AdminVerificationDecisionWorkflowErrorSerializer,
    AdminVerificationLifecycleFieldErrorSerializer,
    AdminVerificationLifecycleWorkflowErrorSerializer,
    AdminVerificationPermissionErrorSerializer,
    AdminVerificationStaleErrorSerializer,
)

ADMIN_VERIFICATION_DECISION_BAD_REQUEST_SCHEMA = PolymorphicProxySerializer(
    component_name='AdminVerificationDecisionBadRequest',
    serializers=[
        AdminVerificationDecisionWorkflowErrorSerializer,
        AdminVerificationDecisionFieldErrorSerializer,
    ],
    resource_type_field_name=None,
)
ADMIN_VERIFICATION_LIFECYCLE_BAD_REQUEST_SCHEMA = PolymorphicProxySerializer(
    component_name='AdminVerificationLifecycleBadRequest',
    serializers=[
        AdminVerificationLifecycleWorkflowErrorSerializer,
        AdminVerificationLifecycleFieldErrorSerializer,
    ],
    resource_type_field_name=None,
)
ADMIN_VERIFICATION_DECISION_BAD_REQUEST_RESPONSE = OpenApiResponse(
    response=ADMIN_VERIFICATION_DECISION_BAD_REQUEST_SCHEMA,
    description=(
        'Payload không hợp lệ hoặc vi phạm state machine. Lỗi nghiệp vụ trả '
        '`code` ổn định; lỗi field-level trả mảng thông báo theo tên field.'
    ),
    examples=[
        OpenApiExample(
            'Invalid transition',
            value={
                'code': 'VERIFICATION_INVALID_TRANSITION',
                'detail': 'Quyết định cuối chỉ áp dụng cho hồ sơ đang được review.',
                'current_status': 'pending',
                'allowed_statuses': ['in_review'],
            },
            response_only=True,
        ),
        OpenApiExample(
            'Tax lookup pending',
            value={
                'code': 'TAX_LOOKUP_PENDING',
                'detail': 'Đang chờ kết quả tra cứu mã số thuế.',
            },
            response_only=True,
        ),
        OpenApiExample(
            'Field validation',
            value={'impact_token': ['Vui lòng xem tác động trước khi xác nhận.']},
            response_only=True,
        ),
    ],
)
ADMIN_VERIFICATION_LIFECYCLE_BAD_REQUEST_RESPONSE = OpenApiResponse(
    response=ADMIN_VERIFICATION_LIFECYCLE_BAD_REQUEST_SCHEMA,
    description=(
        'Payload không hợp lệ hoặc vi phạm state machine. Lỗi nghiệp vụ trả '
        '`code` ổn định; lỗi field-level trả mảng thông báo theo tên field.'
    ),
    examples=[
        OpenApiExample(
            'Invalid transition',
            value={
                'code': 'VERIFICATION_INVALID_TRANSITION',
                'detail': 'Chỉ hồ sơ đã duyệt mới có thể bị thu hồi hoặc hết hiệu lực.',
                'current_status': 'pending',
                'allowed_statuses': ['approved'],
            },
            response_only=True,
        ),
        OpenApiExample(
            'Field validation',
            value={'impact_token': ['Vui lòng xem tác động trước khi xác nhận.']},
            response_only=True,
        ),
    ],
)
ADMIN_VERIFICATION_PERMISSION_RESPONSE = OpenApiResponse(
    response=AdminVerificationPermissionErrorSerializer,
    description='Thiếu permission quản trị bắt buộc cho action.',
    examples=[
        OpenApiExample(
            'Permission denied',
            value={
                'code': 'admin_permission_denied',
                'message': 'Bạn không có quyền thực hiện hành động này.',
            },
            response_only=True,
        )
    ],
)
ADMIN_VERIFICATION_STALE_RESPONSE = OpenApiResponse(
    response=AdminVerificationStaleErrorSerializer,
    description='Preview đã stale; client phải gọi lại endpoint impact.',
    examples=[
        OpenApiExample(
            'Stale impact preview',
            value={
                'code': 'admin_resource_changed',
                'message': ('Dữ liệu đã thay đổi. Vui lòng xem lại tác động trước khi tiếp tục.'),
            },
            response_only=True,
        )
    ],
)
