"""Employer workspace of the public company page (ADR-0017)."""

from rest_framework import status
from rest_framework.permissions import SAFE_METHODS
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from apps.accounts.permissions import IsEmployer

from ...models.page_access import resolve_company_page_access
from ...selectors import (
    company_page_editor_rows,
    company_page_workspace,
    current_company_page_layout,
    pinnable_company_jobs,
)
from ...services import (
    CompanyPageLayoutStale,
    grant_company_page_editor,
    revoke_company_page_editor,
    update_company_page_layout,
)
from ..exceptions import CompanyPageEditForbidden
from ..serializers import CompanyPageEditorGrantSerializer, CompanyPageLayoutSerializer
from .onboarding import _require_company

PINNABLE_JOB_QUERY_MAX_LENGTH = 120


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
        self.recruiter = _require_company(request.user)
        self.access = resolve_company_page_access(self.recruiter)
        if self.required_capability and not getattr(self.access, self.required_capability):
            raise CompanyPageEditForbidden()

    def workspace(self):
        return Response(company_page_workspace(self.recruiter, self.access, request=self.request))

    def editor_row(self, member_id):
        rows = company_page_editor_rows(self.recruiter.company_id)
        return next(row for row in rows if row['member_id'] == member_id)


class CompanyPageWorkspaceView(CompanyPageWorkspaceAPIView):
    def get(self, request):
        return self.workspace()


class CompanyPageLayoutView(CompanyPageWorkspaceAPIView):
    throttle_scope = 'company_page_layout'
    required_capability = 'can_edit_layout'

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

    def get(self, request):
        query = (request.query_params.get('q') or '').strip()[:PINNABLE_JOB_QUERY_MAX_LENGTH]
        return Response({'results': pinnable_company_jobs(self.recruiter.company_id, query=query)})


class CompanyPageEditorListView(CompanyPageWorkspaceAPIView):
    throttle_scope = 'company_page_editors'
    required_capability = 'can_manage_editors'

    def get(self, request):
        return Response({'results': company_page_editor_rows(self.recruiter.company_id)})

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

    def delete(self, request, grant_public_id):
        grant = revoke_company_page_editor(
            company=self.recruiter.company,
            actor=request.user,
            grant_public_id=grant_public_id,
        )
        return Response(self.editor_row(grant.recruiter.public_id))
