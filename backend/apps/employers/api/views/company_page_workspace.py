"""Employer workspace of the public company page (ADR-0017)."""

from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import status
from rest_framework.permissions import SAFE_METHODS
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from apps.accounts.api.permissions import IsEmployer

from ...models.page_access import resolve_company_page_access
from ...selectors import (
    company_page_editor_rows,
    company_page_workspace,
    current_company_page_layout,
    pinnable_company_jobs,
)
from ...services import (
    CompanyPageLayoutStale,
    CompanyUpdateInReview,
    grant_company_page_editor,
    revoke_company_page_editor,
    submit_validated_company_update,
    update_company_page_layout,
)
from ..exceptions import COMPANY_UPDATE_IN_REVIEW, CompanyPageEditForbidden
from ..permissions import require_company_recruiter
from ..serializers import (
    CompanyPageContentSerializer,
    CompanyPageEditorGrantSerializer,
    CompanyPageLayoutSerializer,
)

PINNABLE_JOB_QUERY_MAX_LENGTH = 120
# The workspace and its rows are read models assembled by selectors.
WORKSPACE_RESPONSE = {200: OpenApiTypes.OBJECT}


class CompanyPageWorkspaceAPIView(APIView):
    """Resolves the caller's company and page policy once per request."""

    permission_classes = [IsEmployer]
    throttle_classes = [ScopedRateThrottle]
    # ``CompanyPageAccess`` flag the view requires; empty for the read-only workspace.
    required_capability = ''

    def get_throttles(self):
        # Reads render the workspace; only changes spend the hourly budget.
        return [] if self.request.method in SAFE_METHODS else super().get_throttles()

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        self.recruiter = require_company_recruiter(request.user)
        self.access = resolve_company_page_access(self.recruiter)
        if self.required_capability and not getattr(self.access, self.required_capability):
            raise CompanyPageEditForbidden()

    def workspace(self):
        return Response(company_page_workspace(self.recruiter, self.access, request=self.request))

    def editor_row(self, member_id):
        rows = company_page_editor_rows(self.recruiter.company_id)
        return next(row for row in rows if row['member_id'] == member_id)


class CompanyPageWorkspaceView(CompanyPageWorkspaceAPIView):
    @extend_schema(
        summary='Workspace trang công ty: bố cục, nội dung và quyền của tôi',
        responses=WORKSPACE_RESPONSE,
        tags=['employer'],
    )
    def get(self, request):
        return self.workspace()


class CompanyPageLayoutView(CompanyPageWorkspaceAPIView):
    throttle_scope = 'company_page_layout'
    required_capability = 'can_edit_layout'

    @extend_schema(
        summary='Đổi bố cục trang công ty',
        request=CompanyPageLayoutSerializer,
        responses={**WORKSPACE_RESPONSE, 409: OpenApiTypes.OBJECT},
        tags=['employer'],
    )
    def patch(self, request):
        serializer = CompanyPageLayoutSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        changes = dict(serializer.validated_data)
        try:
            update_company_page_layout(
                self.recruiter.company,
                actor=request.user,
                lock_version=changes.pop('lock_version'),
                changes=changes,
            )
        except CompanyPageLayoutStale:
            return Response(
                {
                    'code': 'COMPANY_PAGE_LAYOUT_STALE',
                    'detail': 'Bố cục đã được thay đổi ở nơi khác. Vui lòng tải lại rồi thử lại.',
                    'layout': current_company_page_layout(self.recruiter.company_id),
                },
                status=status.HTTP_409_CONFLICT,
            )
        return self.workspace()


class CompanyPagePinnableJobsView(CompanyPageWorkspaceAPIView):
    required_capability = 'can_edit_layout'

    @extend_schema(
        summary='Tin tuyển dụng có thể ghim lên trang công ty',
        parameters=[OpenApiParameter('q', str, OpenApiParameter.QUERY, required=False)],
        responses=WORKSPACE_RESPONSE,
        tags=['employer'],
    )
    def get(self, request):
        query = (request.query_params.get('q') or '').strip()[:PINNABLE_JOB_QUERY_MAX_LENGTH]
        return Response({'results': pinnable_company_jobs(self.recruiter.company_id, query=query)})


class CompanyPageEditorListView(CompanyPageWorkspaceAPIView):
    throttle_scope = 'company_page_editors'
    required_capability = 'can_manage_editors'

    @extend_schema(
        summary='Thành viên và quyền biên tập trang công ty',
        responses=WORKSPACE_RESPONSE,
        tags=['employer'],
    )
    def get(self, request):
        return Response({'results': company_page_editor_rows(self.recruiter.company_id)})

    @extend_schema(
        summary='Cấp quyền biên tập trang công ty cho thành viên',
        request=CompanyPageEditorGrantSerializer,
        responses={201: OpenApiTypes.OBJECT},
        tags=['employer'],
    )
    def post(self, request):
        serializer = CompanyPageEditorGrantSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        grant = grant_company_page_editor(
            company=self.recruiter.company,
            actor=request.user,
            member_id=serializer.validated_data['member_id'],
        )
        return Response(
            self.editor_row(grant.recruiter.public_id),
            status=status.HTTP_201_CREATED,
        )


class CompanyPageEditorDetailView(CompanyPageWorkspaceAPIView):
    throttle_scope = 'company_page_editors'
    required_capability = 'can_manage_editors'

    @extend_schema(
        summary='Thu hồi quyền biên tập trang công ty',
        request=None,
        responses=WORKSPACE_RESPONSE,
        tags=['employer'],
    )
    def delete(self, request, grant_public_id):
        grant = revoke_company_page_editor(
            company=self.recruiter.company,
            actor=request.user,
            grant_public_id=grant_public_id,
        )
        return Response(self.editor_row(grant.recruiter.public_id))


class CompanyPageContentView(CompanyPageWorkspaceAPIView):
    """Page content goes through moderation: it merges into the caller's request."""

    throttle_scope = 'company_page_content'
    required_capability = 'can_edit_content'

    @extend_schema(
        summary='Gửi nội dung trang công ty vào yêu cầu cập nhật chờ duyệt',
        request=CompanyPageContentSerializer,
        responses={**WORKSPACE_RESPONSE, 409: OpenApiTypes.OBJECT},
        tags=['employer'],
    )
    def post(self, request):
        def validate(company, active_request):
            serializer = CompanyPageContentSerializer(
                data=request.data,
                context={
                    'request': request,
                    'company': company,
                    'recruiter': self.recruiter,
                    'page_access': self.access,
                },
            )
            serializer.is_valid(raise_exception=True)
            return serializer.validated_data

        try:
            submit_validated_company_update(
                company_id=self.recruiter.company_id,
                requester=request.user,
                validate=validate,
                merge=True,
            )
        except CompanyUpdateInReview:
            return Response(COMPANY_UPDATE_IN_REVIEW, status=status.HTTP_409_CONFLICT)
        return self.workspace()
