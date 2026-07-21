from rest_framework import generics, status
from rest_framework.response import Response

from apps.accounts.permissions import IsEmployer

from ...selectors import employer_job_detail_queryset, employer_job_list_queryset
from ...services import create_pending_job, update_employer_job
from ..serializers import (
    EmployerJobDetailSerializer,
    EmployerJobListSerializer,
    EmployerJobWriteSerializer,
)


class EmployerJobListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsEmployer]

    def get_serializer_class(self):
        return (
            EmployerJobWriteSerializer
            if self.request.method == 'POST'
            else EmployerJobListSerializer
        )

    def get_queryset(self):
        return employer_job_list_queryset(self.request.user)

    def create(self, request, *args, **kwargs):
        serializer = EmployerJobWriteSerializer(
            data=request.data, context=self.get_serializer_context()
        )
        serializer.is_valid(raise_exception=True)
        job = create_pending_job(serializer, request.user)
        job = employer_job_detail_queryset(request.user).get(pk=job.pk)
        data = EmployerJobDetailSerializer(job, context=self.get_serializer_context()).data
        return Response(data, status=status.HTTP_201_CREATED)


class EmployerJobDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsEmployer]
    lookup_field = 'public_id'

    def get_serializer_class(self):
        return (
            EmployerJobWriteSerializer
            if self.request.method in {'PUT', 'PATCH'}
            else EmployerJobDetailSerializer
        )

    def get_queryset(self):
        return employer_job_detail_queryset(self.request.user)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        job = self.get_object()
        serializer = EmployerJobWriteSerializer(
            job,
            data=request.data,
            partial=partial,
            context=self.get_serializer_context(),
        )
        serializer.is_valid(raise_exception=True)
        update_employer_job(serializer)
        job = employer_job_detail_queryset(request.user).get(pk=job.pk)
        data = EmployerJobDetailSerializer(job, context=self.get_serializer_context()).data
        return Response(data)
