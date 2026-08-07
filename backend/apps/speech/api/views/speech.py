from drf_spectacular.utils import OpenApiTypes, extend_schema
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import HasAdminPermission
from apps.speech.api.serializers import SpeechSessionRequestSerializer
from apps.speech.selectors import published_blog_post_for_speech, speech_admin_overview
from apps.speech.services import (
    SpeechFeatureDisabled,
    SpeechQuotaExceeded,
    SpeechQuotaUnavailable,
    create_blog_post_speech_session,
    create_text_speech_session,
    get_speech_catalog,
    get_speech_policy,
    record_speech_usage,
)
from apps.speech.services.client import (
    SpeechServiceRejected,
    SpeechServiceUnavailable,
    tts_service_client,
)
from common.client_ip import client_ip
from common.throttling import ClientIPScopedRateThrottle


def _unavailable_response():
    return Response(
        {
            'code': 'speech_unavailable',
            'detail': 'Giọng đọc đang bận hoặc chưa sẵn sàng. Vui lòng thử lại sau.',
        },
        status=status.HTTP_503_SERVICE_UNAVAILABLE,
        headers={'Retry-After': '3'},
    )


class SpeechVoiceCatalogView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_classes = [ClientIPScopedRateThrottle]
    throttle_scope = 'speech_catalog'

    @extend_schema(responses={200: OpenApiTypes.OBJECT, 503: OpenApiTypes.OBJECT}, tags=['speech'])
    def get(self, request):
        try:
            data = get_speech_catalog()
        except (SpeechFeatureDisabled, SpeechServiceUnavailable, SpeechServiceRejected):
            return _unavailable_response()
        response = Response(data)
        response['Cache-Control'] = 'private, max-age=60'
        return response


class SpeechSessionView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_classes = [ClientIPScopedRateThrottle]
    throttle_scope = 'speech_session'

    def get_throttles(self):
        # Ad-hoc text is written by the caller, so it can never be de-duplicated
        # across visitors the way a published article is. It gets its own,
        # tighter bucket rather than competing with people reading the blog.
        body = self.request.data
        if isinstance(body, dict) and body.get('source_type') == 'text':
            self.throttle_scope = 'speech_adhoc'
        return super().get_throttles()

    @extend_schema(
        request=SpeechSessionRequestSerializer,
        responses={
            201: OpenApiTypes.OBJECT,
            404: OpenApiTypes.OBJECT,
            429: OpenApiTypes.OBJECT,
            503: OpenApiTypes.OBJECT,
        },
        tags=['speech'],
    )
    def post(self, request):
        serializer = SpeechSessionRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        post = None
        surface = 'blog' if data['source_type'] == 'blog_post' else data['surface']
        if data['source_type'] == 'blog_post':
            post = published_blog_post_for_speech(data['source_public_id'])
            if post is None:
                return Response(
                    {'code': 'speech_source_not_found', 'detail': 'Không tìm thấy bài viết.'},
                    status=status.HTTP_404_NOT_FOUND,
                )

        authenticated = bool(request.user and request.user.is_authenticated)
        quota_subject = (
            str(request.user.pk)
            if authenticated
            else (client_ip(request) or request.META.get('REMOTE_ADDR') or 'unknown')
        )
        try:
            if post is not None:
                session = create_blog_post_speech_session(
                    post=post,
                    quota_subject=quota_subject,
                    authenticated=authenticated,
                )
            else:
                session = create_text_speech_session(
                    text=data['text'],
                    surface=surface,
                    quota_subject=quota_subject,
                    authenticated=authenticated,
                )
        except SpeechFeatureDisabled:
            record_speech_usage(surface, rejected_count=1)
            return Response(
                {'code': 'speech_disabled', 'detail': 'Giọng đọc chưa được bật cho tính năng này.'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        except SpeechQuotaExceeded as error:
            record_speech_usage(surface, rejected_count=1)
            return Response(
                {
                    'code': 'speech_quota_exceeded',
                    'detail': 'Bạn đã dùng hết lượt tạo giọng đọc hôm nay.',
                },
                status=status.HTTP_429_TOO_MANY_REQUESTS,
                headers={'Retry-After': str(error.retry_after)},
            )
        except SpeechQuotaUnavailable:
            record_speech_usage(surface, unavailable_count=1)
            return _unavailable_response()
        except SpeechServiceRejected:
            record_speech_usage(surface, rejected_count=1)
            return Response(
                {'code': 'speech_request_rejected', 'detail': 'Yêu cầu giọng đọc không hợp lệ.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except SpeechServiceUnavailable:
            record_speech_usage(surface, unavailable_count=1)
            return _unavailable_response()

        response = Response(session, status=status.HTTP_201_CREATED)
        response['Cache-Control'] = 'no-store'
        return response


class AdminSpeechOverviewView(APIView):
    permission_classes = [HasAdminPermission]
    required_admin_permissions = {'GET': ['site_setting.view']}
    require_superuser = True

    @extend_schema(responses={200: OpenApiTypes.OBJECT}, tags=['speech-admin'])
    def get(self, request):
        try:
            runtime = tts_service_client.status()
        except SpeechServiceUnavailable:
            runtime = {'status': 'unavailable'}
        response = Response(speech_admin_overview(runtime=runtime, policy=get_speech_policy()))
        response['Cache-Control'] = 'private, no-store'
        return response
