from django.shortcuts import get_object_or_404
from rest_framework import generics, serializers, status
from rest_framework.response import Response

from apps.accounts.permissions import IsEmployer
from apps.employers.services import ensure_recruiter_job_workspace

from ...selectors import (
    attach_job_candidate_previews,
    employer_job_detail_queryset,
    employer_job_list_queryset,
)
from ...services import (
    close_job,
    delete_job_draft,
    duplicate_job,
    employer_job_posting_context,
    extend_job_deadline,
    publish_job,
    reopen_job,
    save_job_draft,
    update_employer_job,
)
from ..serializers import (
    EmployerJobDetailSerializer,
    EmployerJobDraftSerializer,
    EmployerJobListSerializer,
    EmployerJobPostingContextSerializer,
    EmployerJobWriteSerializer,
)


class EmployerJobWorkspaceReadMixin:
    """Authoritatively gate recruiter workspace reads and cache their state."""

    def employer_workspace_readiness(self):
        readiness = getattr(self, '_employer_workspace_readiness', None)
        if readiness is None:
            _, readiness = ensure_recruiter_job_workspace(self.request.user)
            self._employer_workspace_readiness = readiness
        return readiness


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
            return self.get_paginated_response(serializer.data)

        jobs = list(queryset)
        if self.employer_workspace_readiness()['candidate_data_access']:
            attach_job_candidate_previews(jobs)
        return Response(self.get_serializer(jobs, many=True).data)

    def create(self, request, *args, **kwargs):
        is_draft = request.query_params.get('as') == 'draft'
        serializer_class = EmployerJobDraftSerializer if is_draft else EmployerJobWriteSerializer
        serializer = serializer_class(data=request.data, context=self.get_serializer_context())
        serializer.is_valid(raise_exception=True)
        job = save_job_draft(serializer, request.user)
        if not is_draft:
            job = publish_job(job, request.user)
        job = employer_job_detail_queryset(request.user).get(pk=job.pk)
        data = EmployerJobDetailSerializer(job, context=self.get_serializer_context()).data
        return Response(data, status=status.HTTP_201_CREATED)


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
        update_employer_job(serializer, request.user)
        job = employer_job_detail_queryset(request.user).get(pk=job.pk)
        data = EmployerJobDetailSerializer(job, context=self.get_serializer_context()).data
        return Response(data)

    def destroy(self, request, *args, **kwargs):
        job = self.get_object()
        delete_job_draft(job, request.user)
        return Response(status=status.HTTP_204_NO_CONTENT)


class EmployerJobPostingContextView(generics.GenericAPIView):
    permission_classes = [IsEmployer]
    serializer_class = EmployerJobPostingContextSerializer

    def get(self, request):
        return Response(employer_job_posting_context(request.user))


class EmployerJobSubmitView(generics.GenericAPIView):
    permission_classes = [IsEmployer]

    def post(self, request, public_id):
        job = get_object_or_404(employer_job_detail_queryset(request.user), public_id=public_id)
        job = publish_job(job, request.user)
        return Response(
            EmployerJobDetailSerializer(job, context=self.get_serializer_context()).data
        )


class EmployerJobCloseView(generics.GenericAPIView):
    permission_classes = [IsEmployer]

    def post(self, request, public_id):
        job = close_job(
            get_object_or_404(employer_job_detail_queryset(request.user), public_id=public_id),
            request.user,
        )
        return Response(
            EmployerJobDetailSerializer(job, context=self.get_serializer_context()).data
        )


class DeadlineSerializer(serializers.Serializer):
    deadline = serializers.DateField()


class EmployerJobReopenView(generics.GenericAPIView):
    permission_classes = [IsEmployer]

    def post(self, request, public_id):
        serializer = DeadlineSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        job = reopen_job(
            get_object_or_404(employer_job_detail_queryset(request.user), public_id=public_id),
            request.user,
            serializer.validated_data['deadline'],
        )
        return Response(
            EmployerJobDetailSerializer(job, context=self.get_serializer_context()).data
        )


class EmployerJobExtendView(generics.GenericAPIView):
    permission_classes = [IsEmployer]

    def post(self, request, public_id):
        serializer = DeadlineSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        job = extend_job_deadline(
            get_object_or_404(employer_job_detail_queryset(request.user), public_id=public_id),
            request.user,
            serializer.validated_data['deadline'],
        )
        return Response(
            EmployerJobDetailSerializer(job, context=self.get_serializer_context()).data
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
