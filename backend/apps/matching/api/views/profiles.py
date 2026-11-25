from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema
from rest_framework.exceptions import NotFound
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.api.permissions import IsCandidate

from ...selectors import owner_cv_for_matching, owner_cv_profile


class CvProfileView(APIView):
    """Hồ sơ trích xuất từ một CV của chính ứng viên: thứ nhà tuyển dụng nhìn thấy khi tìm kiếm."""

    permission_classes = [IsCandidate]

    @extend_schema(
        summary='Hồ sơ trích xuất từ CV của ứng viên',
        description=(
            '`status`: `ready` (có `profile`), `pending` (CV vừa lưu, chưa trích xuất xong), '
            '`failed` (không đọc được CV, kèm `error_code`). Chỉ đọc; không chứa chữ nguyên văn '
            'ngoài các mục liệt kê.'
        ),
        responses={200: OpenApiTypes.OBJECT},
        tags=['Matching'],
    )
    def get(self, request, cv_public_id):
        cv = owner_cv_for_matching(request.user, cv_public_id)
        if cv is None:
            raise NotFound
        return Response(owner_cv_profile(cv))
