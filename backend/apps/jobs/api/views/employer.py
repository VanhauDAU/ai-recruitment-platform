from django.shortcuts import get_object_or_404
from drf_spectacular.utils import OpenApiParameter, extend_schema, extend_schema_view
from rest_framework import generics, serializers, status
from rest_framework.response import Response

from apps.accounts.api.permissions import IsEmployer
from apps.employers.services import ensure_recruiter_job_workspace

from ...selectors import (
    attach_job_candidate_previews,
    employer_job_detail_queryset,
    employer_job_list_queryset,
    employer_job_status_counts,
)
from ...services import (
    close_job,
    delete_job_draft,
    duplicate_job,
    employer_job_posting_context,
    extend_job_deadline,
    publish_job,
    reopen_job,
    resubmit_job_for_review,
    save_job_draft,
    update_employer_job,
)
from ..serializers import (
    EmployerJobDetailSerializer,
    EmployerJobDraftSerializer,
    EmployerJobListSerializer,
    EmployerJobPostingContextSerializer,
    EmployerJobWriteSerializer,
    JobResponsibilityAcknowledgementSerializer,
)


def _accepted_statement_version(request):
    """Read which commitment version the recruiter accepted with this request."""
    serializer = JobResponsibilityAcknowledgementSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    return serializer.validated_data['responsibility_statement_version']


class EmployerJobWorkspaceReadMixin:
    """Authoritatively gate recruiter workspace reads and cache their state."""

    def employer_workspace_readiness(self):
        readiness = getattr(self, '_employer_workspace_readiness', None)
        if readiness is None:
            _, readiness = ensure_recruiter_job_workspace(self.request.user)
            self._employer_workspace_readiness = readiness
        return readiness


@extend_schema_view(
    list=extend_schema(summary='Tin tuyển dụng của NTD (kèm status_counts khi phân trang)'),
    create=extend_schema(
        summary='Tạo tin: đăng ngay, hoặc lưu nháp với ?as=draft',
        parameters=[OpenApiParameter('as', str, enum=['draft'])],
        request=EmployerJobWriteSerializer,
        responses={201: EmployerJobDetailSerializer},
    ),
)
@extend_schema(tags=['jobs'])
class EmployerJobListCreateView(EmployerJobWorkspaceReadMixin, generics.ListCreateAPIView):
    permission_classes = [IsEmployer]

    def get_serializer_class(self):
        return (
            EmployerJobDraftSerializer
            if self.request.method == 'POST'
            else EmployerJobListSerializer
        )

    def get_queryset(self):
        self.employer_workspace_readiness()
        return employer_job_list_queryset(
            self.request.user,
            status=self.request.query_params.get('status'),
            campaign=self.request.query_params.get('campaign'),
            q=self.request.query_params.get('q'),
        )

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        page = self.paginate_queryset(queryset)
        if page is not None:
            if self.employer_workspace_readiness()['candidate_data_access']:
                attach_job_candidate_previews(page)
            serializer = self.get_serializer(page, many=True)
            response = self.get_paginated_response(serializer.data)
            # Counts of every status tab under the same campaign/search scope,
            # so the tabs stay correct whichever tab the page is showing.
            response.data['status_counts'] = employer_job_status_counts(
                request.user,
                campaign=request.query_params.get('campaign'),
                q=request.query_params.get('q'),
            )
            return response

        jobs = list(queryset)
        if self.employer_workspace_readiness()['candidate_data_access']:
            attach_job_candidate_previews(jobs)
        return Response(self.get_serializer(jobs, many=True).data)

    def create(self, request, *args, **kwargs):
        is_draft = request.query_params.get('as') == 'draft'
        serializer_class = EmployerJobDraftSerializer if is_draft else EmployerJobWriteSerializer
        serializer = serializer_class(data=request.data, context=self.get_serializer_context())
        serializer.is_valid(raise_exception=True)
        job = save_job_draft(request.user, serializer.validated_data)
        if not is_draft:
            job = publish_job(
                job,
                request.user,
                accepted_statement_version=_accepted_statement_version(request),
            )
        job = employer_job_detail_queryset(request.user).get(pk=job.pk)
        data = EmployerJobDetailSerializer(job, context=self.get_serializer_context()).data
        return Response(data, status=status.HTTP_201_CREATED)


@extend_schema_view(
    update=extend_schema(responses=EmployerJobDetailSerializer),
    partial_update=extend_schema(responses=EmployerJobDetailSerializer),
    destroy=extend_schema(summary='Xóa tin nháp'),
)
@extend_schema(tags=['jobs'])
class EmployerJobDetailView(EmployerJobWorkspaceReadMixin, generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsEmployer]
    lookup_field = 'public_id'

    def get_serializer_class(self):
        return (
            EmployerJobDraftSerializer
            if self.request.method in {'PUT', 'PATCH'}
            else EmployerJobDetailSerializer
        )

    def get_queryset(self):
        self.employer_workspace_readiness()
        return employer_job_detail_queryset(self.request.user)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        job = self.get_object()
        serializer_class = (
            EmployerJobDraftSerializer
            if job.status == job.Status.DRAFT
            else EmployerJobWriteSerializer
        )
        serializer = serializer_class(
            job,
            data=request.data,
            partial=partial,
            context=self.get_serializer_context(),
        )
        serializer.is_valid(raise_exception=True)
        update_employer_job(job, request.user, serializer.validated_data)
        job = employer_job_detail_queryset(request.user).get(pk=job.pk)
        data = EmployerJobDetailSerializer(job, context=self.get_serializer_context()).data
        return Response(data)

    def destroy(self, request, *args, **kwargs):
        job = self.get_object()
        delete_job_draft(job, request.user)
        return Response(status=status.HTTP_204_NO_CONTENT)


@extend_schema(tags=['jobs'], summary='Hạn mức, cam kết và điều kiện đăng tin của NTD')
class EmployerJobPostingContextView(generics.GenericAPIView):
    permission_classes = [IsEmployer]
    serializer_class = EmployerJobPostingContextSerializer

    def get(self, request):
        return Response(employer_job_posting_context(request.user))


# Serializes a job a service just changed, with freshly computed visibility
# (a comment, not a docstring, so it does not become every view's API text).
class FreshJobDetailMixin:
    def fresh_detail(self, job):
        job = employer_job_detail_queryset(self.request.user).get(pk=job.pk)
        return EmployerJobDetailSerializer(job, context=self.get_serializer_context()).data


@extend_schema(
    tags=['jobs'],
    summary='Đăng tin nháp',
    request=JobResponsibilityAcknowledgementSerializer,
    responses=EmployerJobDetailSerializer,
)
class EmployerJobSubmitView(FreshJobDetailMixin, generics.GenericAPIView):
    permission_classes = [IsEmployer]

    def post(self, request, public_id):
        job = get_object_or_404(employer_job_detail_queryset(request.user), public_id=public_id)
        job = publish_job(
            job,
            request.user,
            accepted_statement_version=_accepted_statement_version(request),
        )
        return Response(self.fresh_detail(job))


@extend_schema(
    tags=['jobs'], summary='Ngừng tuyển', request=None, responses=EmployerJobDetailSerializer
)
class EmployerJobCloseView(FreshJobDetailMixin, generics.GenericAPIView):
    permission_classes = [IsEmployer]

    def post(self, request, public_id):
        job = close_job(
            get_object_or_404(employer_job_detail_queryset(request.user), public_id=public_id),
            request.user,
        )
        return Response(self.fresh_detail(job))


class DeadlineSerializer(serializers.Serializer):
    deadline = serializers.DateField(error_messages={'required': 'Chọn hạn nhận hồ sơ.'})


@extend_schema(
    tags=['jobs'],
    summary='Mở lại tin đã ngừng tuyển với hạn nhận hồ sơ mới',
    request=DeadlineSerializer,
    responses=EmployerJobDetailSerializer,
)
class EmployerJobReopenView(FreshJobDetailMixin, generics.GenericAPIView):
    permission_classes = [IsEmployer]

    def post(self, request, public_id):
        serializer = DeadlineSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        job = reopen_job(
            get_object_or_404(employer_job_detail_queryset(request.user), public_id=public_id),
            request.user,
            serializer.validated_data['deadline'],
            accepted_statement_version=_accepted_statement_version(request),
        )
        return Response(self.fresh_detail(job))


@extend_schema(
    tags=['jobs'],
    summary='Gia hạn nhận hồ sơ',
    request=DeadlineSerializer,
    responses=EmployerJobDetailSerializer,
)
class EmployerJobExtendView(FreshJobDetailMixin, generics.GenericAPIView):
    permission_classes = [IsEmployer]

    def post(self, request, public_id):
        serializer = DeadlineSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        job = extend_job_deadline(
            get_object_or_404(employer_job_detail_queryset(request.user), public_id=public_id),
            request.user,
            serializer.validated_data['deadline'],
        )
        return Response(self.fresh_detail(job))


@extend_schema(
    tags=['jobs'],
    summary='Gửi lại tin đã sửa theo yêu cầu kiểm duyệt',
    request=None,
    responses=EmployerJobDetailSerializer,
)
class EmployerJobResubmitView(FreshJobDetailMixin, generics.GenericAPIView):
    """Send a job fixed after a change request back to the review queue."""

    permission_classes = [IsEmployer]

    def post(self, request, public_id):
        job = resubmit_job_for_review(
            get_object_or_404(employer_job_detail_queryset(request.user), public_id=public_id),
            request.user,
        )
        return Response(self.fresh_detail(job))


@extend_schema(
    tags=['jobs'],
    summary='Sao chép tin thành bản nháp',
    request=None,
    responses={201: EmployerJobDetailSerializer},
)
class EmployerJobDuplicateView(generics.GenericAPIView):
    permission_classes = [IsEmployer]

    def post(self, request, public_id):
        job = duplicate_job(
            get_object_or_404(employer_job_detail_queryset(request.user), public_id=public_id),
            request.user,
        )
        job = employer_job_detail_queryset(request.user).get(pk=job.pk)
        return Response(
            EmployerJobDetailSerializer(job, context=self.get_serializer_context()).data,
            status=status.HTTP_201_CREATED,
        )
