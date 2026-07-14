"""Recruiter-only read endpoints for immutable application CV snapshots."""

from django.http import Http404
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsEmployer

from .api_v2_serializers import RecruiterApplicationSnapshotSerializer
from .models import Application
from .selectors import recruiter_application_snapshot_queryset


class RecruiterApplicationSnapshotView(APIView):
    permission_classes = [IsEmployer]

    def get(self, request, public_id):
        try:
            application = recruiter_application_snapshot_queryset(request.user).get(public_id=public_id)
        except Application.DoesNotExist as error:
            # A 404 deliberately avoids confirming the existence of an
            # application outside the recruiter’s company relationship.
            raise Http404 from error
        return Response(RecruiterApplicationSnapshotSerializer(application).data)
