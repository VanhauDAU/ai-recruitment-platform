"""Cột ngữ cảnh, chọn nội dung để gửi, PDF CV dựng bằng trình tạo CV, lịch hẹn."""

from django.http import FileResponse, Http404
from django.urls import reverse
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from apps.cvs.services import (
    CvExportPermissionError,
    CvExportUnavailableError,
    application_snapshot_export,
    export_download_ready,
    request_application_snapshot_export,
)
from apps.employers.services import ensure_recruiter_candidate_data_access
from common.api.throttling import WriteScopedRateThrottle, with_account_write_cap
from common.storage.media import media_url_from_value
from common.storage.r2 import private_media_storage

from ...models import Message
from ...selectors import applied_jobs_for_candidate, message_for, shareable_cvs, shareable_jobs
from ...services import (
    cancel_interview,
    complete_interview,
    present_message,
    propose_interview,
    respond_to_interview,
)
from ..serializers import (
    InterviewCancelSerializer,
    InterviewCreateSerializer,
    InterviewRespondSerializer,
)
from .conversations import PortalView, get_conversation


@extend_schema(
    tags=['messaging'],
    summary='Tin đã ứng tuyển (cột phải ProCV Connect) kèm hội thoại đã có',
    responses={200: OpenApiTypes.OBJECT},
)
class AppliedJobsView(PortalView):
    def get(self, request):
        return Response(
            [
                {
                    'application_public_id': application.public_id,
                    'job': {
                        'public_id': application.job.public_id,
                        'title': application.job.title,
                        'slug': application.job.slug,
                    },
                    'company': {
                        'name': application.job.company.company_name,
                        'logo_url': media_url_from_value(application.job.company.logo_url) or None,
                    },
                    'conversation_public_id': conversation_id,
                    'can_start': open_,
                }
                for application, conversation_id, open_ in applied_jobs_for_candidate(request.user)
            ]
        )


@extend_schema(
    tags=['messaging'],
    summary='CV của tôi có thể gửi trong hội thoại',
    responses={200: OpenApiTypes.OBJECT},
)
class ShareableCvsView(PortalView):
    def get(self, request):
        return Response(
            [
                {'public_id': cv.public_id, 'title': cv.title, 'cv_type': cv.cv_type}
                for cv in shareable_cvs(request.user)
            ]
        )


@extend_schema(
    tags=['messaging'],
    summary='Tin đang tuyển của công ty có thể gửi cho ứng viên',
    responses={200: OpenApiTypes.OBJECT},
)
class ShareableJobsView(PortalView):
    def get(self, request):
        return Response(
            [
                {'public_id': job.public_id, 'title': job.title, 'slug': job.slug}
                for job in shareable_jobs(request.user)
            ]
        )


def _cv_message(request, role, public_id, message_id):
    conversation = get_conversation(request, role, public_id)
    message = message_for(conversation, message_id)
    if message is None or message.kind != Message.Kind.CV or message.cv_version is None:
        raise Http404
    ensure_recruiter_candidate_data_access(request.user)
    return message


def _export_payload(request, public_id, message, export):
    url = None
    if export_download_ready(export):
        url = request.build_absolute_uri(
            reverse(
                'employer-conversation-cv-export-download',
                args=[public_id, message.public_id, export.public_id],
            )
        )
    return {'public_id': export.public_id, 'status': export.status, 'download_url': url}


def _export(message, export_id):
    try:
        return application_snapshot_export(version=message.cv_version, export_public_id=export_id)
    except CvExportUnavailableError as error:
        raise Http404 from error


@extend_schema(
    tags=['messaging'],
    summary='NTD yêu cầu PDF của CV dựng bằng trình tạo CV được gửi trong hội thoại',
    request=None,
    responses={200: OpenApiTypes.OBJECT, 201: OpenApiTypes.OBJECT},
)
class MessageCvExportView(PortalView):
    throttle_classes = with_account_write_cap(WriteScopedRateThrottle)
    throttle_scope = 'application_cv_export'

    def post(self, request, public_id, message_id):
        message = _cv_message(request, self.role, public_id, message_id)
        if message.cv_version.source_file_key:
            raise ValidationError({'detail': 'CV này là tệp tải lên, hãy mở tệp gốc.'})
        try:
            export, reused = request_application_snapshot_export(
                version=message.cv_version, actor=request.user
            )
        except CvExportPermissionError as error:
            raise ValidationError({'detail': str(error)}) from error
        return Response(
            _export_payload(request, public_id, message, export),
            status=status.HTTP_200_OK if reused else status.HTTP_201_CREATED,
        )


@extend_schema(
    tags=['messaging'],
    summary='Trạng thái PDF CV được gửi trong hội thoại',
    responses={200: OpenApiTypes.OBJECT},
)
class MessageCvExportDetailView(PortalView):
    def get(self, request, public_id, message_id, export_id):
        message = _cv_message(request, self.role, public_id, message_id)
        return Response(_export_payload(request, public_id, message, _export(message, export_id)))


@extend_schema(
    tags=['messaging'],
    summary='Tải PDF CV được gửi trong hội thoại',
    responses={(200, 'application/pdf'): OpenApiTypes.BINARY},
)
class MessageCvExportDownloadView(PortalView):
    def get(self, request, public_id, message_id, export_id):
        message = _cv_message(request, self.role, public_id, message_id)
        export = _export(message, export_id)
        if not export_download_ready(export):
            raise Http404
        title = (message.payload or {}).get('cv_title') or 'CV'
        response = FileResponse(
            private_media_storage().open(export.storage_key, 'rb'),
            as_attachment=True,
            filename=f'{title}.pdf',
            content_type='application/pdf',
        )
        response['Cache-Control'] = 'private, no-store'
        return response


class _InterviewView(PortalView):
    throttle_classes = with_account_write_cap(WriteScopedRateThrottle)
    throttle_scope = 'chat_interview'


@extend_schema(
    tags=['messaging'],
    summary='NTD đề xuất lịch phỏng vấn trong hội thoại',
    request=InterviewCreateSerializer,
    responses={201: OpenApiTypes.OBJECT},
)
class InterviewCreateView(_InterviewView):
    def post(self, request, public_id):
        serializer = InterviewCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        message = propose_interview(request.user, public_id, serializer.validated_data)
        return Response(present_message(message, self.role), status=status.HTTP_201_CREATED)


def _card(interview, role):
    message = (
        interview.messages.select_related('interview', 'cv_version')
        .filter(kind=Message.Kind.INTERVIEW)
        .first()
    )
    return present_message(message, role)


@extend_schema(
    tags=['messaging'],
    summary='Ứng viên nhận, từ chối hoặc xin đổi giờ phỏng vấn',
    request=InterviewRespondSerializer,
    responses={200: OpenApiTypes.OBJECT},
)
class InterviewRespondView(_InterviewView):
    def post(self, request, public_id):
        serializer = InterviewRespondSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        interview = respond_to_interview(
            request.user,
            public_id,
            serializer.validated_data['action'],
            serializer.validated_data['note'],
        )
        return Response(_card(interview, self.role))


@extend_schema(
    tags=['messaging'],
    summary='NTD hủy lịch phỏng vấn',
    request=InterviewCancelSerializer,
    responses={200: OpenApiTypes.OBJECT},
)
class InterviewCancelView(_InterviewView):
    def post(self, request, public_id):
        serializer = InterviewCancelSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        interview = cancel_interview(request.user, public_id, serializer.validated_data['note'])
        return Response(_card(interview, self.role))


@extend_schema(
    tags=['messaging'],
    summary='NTD đánh dấu đã phỏng vấn',
    request=None,
    responses={200: OpenApiTypes.OBJECT},
)
class InterviewCompleteView(_InterviewView):
    def post(self, request, public_id):
        return Response(_card(complete_interview(request.user, public_id), self.role))
