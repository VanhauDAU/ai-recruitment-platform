"""HTTP adapters for administrator review of job submissions."""

from django.shortcuts import get_object_or_404
from rest_framework import generics
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsAdmin

from ...selectors import job_moderation_queryset
from ...services import approve_job, reject_job
from ..serializers import AdminJobModerationSerializer, AdminJobReviewSerializer


class AdminJobModerationListView(generics.ListAPIView):
    permission_classes = [IsAdmin]
    serializer_class = AdminJobModerationSerializer

    def get_queryset(self):
        return job_moderation_queryset(status=self.request.query_params.get('status'))


class AdminJobReviewView(APIView):
    permission_classes = [IsAdmin]

    def post(self, request, public_id):
        job = get_object_or_404(job_moderation_queryset(), public_id=public_id)
        serializer = AdminJobReviewSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        if serializer.validated_data['action'] == 'approve':
            job = approve_job(job=job, user=request.user)
        else:
            job = reject_job(
                job=job,
                user=request.user,
                reason=serializer.validated_data.get('reason', ''),
            )
        return Response(AdminJobModerationSerializer(job).data)
