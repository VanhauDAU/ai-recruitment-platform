import csv

from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from rest_framework import generics
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsEmployer

from ...selectors import (
    employer_application_queryset,
    employer_applications_queryset,
)
from ...services import (
    InvalidApplicationStatusTransition,
    update_application_status,
)
from ..serializers.employer import ApplicationSerializer, ApplicationStatusUpdateSerializer
from ..serializers.history import ApplicationStatusHistorySerializer


def _csv_cell(value):
    """Prevent spreadsheet formula execution when the exported CSV is opened."""
    text = str(value or '')
    return f"'{text}" if text.startswith(('=', '+', '-', '@')) else text


class EmployerApplicationListView(generics.ListAPIView):
    serializer_class = ApplicationSerializer
    permission_classes = [IsEmployer]

    def get_queryset(self):
        return employer_applications_queryset(
            self.request.user,
            self.request.query_params.get('job'),
            status=self.request.query_params.get('status'),
            campaign=self.request.query_params.get('campaign'),
            q=self.request.query_params.get('q'),
            scope=self.request.query_params.get('scope'),
            ordering=self.request.query_params.get('ordering'),
            latest_only=self.request.query_params.get('latest') in {'1', 'true'},
        )


class EmployerApplicationExportView(APIView):
    permission_classes = [IsEmployer]

    def get(self, request):
        queryset = employer_applications_queryset(
            request.user,
            request.query_params.get('job'),
            status=request.query_params.get('status'),
            campaign=request.query_params.get('campaign'),
            q=request.query_params.get('q'),
            scope=request.query_params.get('scope'),
            ordering=request.query_params.get('ordering'),
            latest_only=True,
        )
        response = HttpResponse(content_type='text/csv; charset=utf-8')
        response['Content-Disposition'] = 'attachment; filename="campaign-applications.csv"'
        response.write('\ufeff')
        writer = csv.writer(response)
        writer.writerow(
            [
                'Ứng viên',
                'Email',
                'Tin tuyển dụng',
                'CV đã nộp',
                'Trạng thái',
                'Ngày ứng tuyển',
            ]
        )
        for application in queryset.iterator(chunk_size=200):
            writer.writerow(
                [
                    _csv_cell(application.candidate.full_name or application.candidate.email),
                    _csv_cell(application.candidate.email),
                    _csv_cell(application.job.title),
                    _csv_cell(application.submitted_cv_title),
                    _csv_cell(application.get_status_display()),
                    application.applied_at.isoformat(),
                ]
            )
        return response


class EmployerApplicationStatusUpdateView(generics.UpdateAPIView):
    serializer_class = ApplicationStatusUpdateSerializer
    permission_classes = [IsEmployer]
    lookup_field = 'public_id'

    def get_queryset(self):
        return employer_application_queryset(self.request.user)

    def perform_update(self, serializer):
        try:
            update_application_status(serializer, changed_by=self.request.user)
        except InvalidApplicationStatusTransition as error:
            raise ValidationError({'status': str(error)}) from error

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        application = self.get_object()
        serializer = self.get_serializer(application, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        application = employer_applications_queryset(self.request.user).get(pk=application.pk)
        return Response(ApplicationSerializer(application).data)


class EmployerApplicationHistoryView(generics.ListAPIView):
    permission_classes = [IsEmployer]
    serializer_class = ApplicationStatusHistorySerializer

    def get_queryset(self):
        application = get_object_or_404(
            employer_application_queryset(self.request.user), public_id=self.kwargs['public_id']
        )
        return application.status_history.select_related('changed_by')
