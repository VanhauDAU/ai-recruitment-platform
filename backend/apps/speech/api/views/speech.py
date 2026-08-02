from drf_spectacular.utils import OpenApiTypes, extend_schema
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.speech.api.serializers import SpeechSessionRequestSerializer
from apps.speech.selectors import published_blog_post_for_speech
from apps.speech.services import create_blog_post_speech_session, get_speech_catalog
from apps.speech.services.client import SpeechServiceRejected, SpeechServiceUnavailable
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
        except (SpeechServiceUnavailable, SpeechServiceRejected):
            return _unavailable_response()
        response = Response(data)
        response['Cache-Control'] = 'private, max-age=60'
        return response


class SpeechSessionView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_classes = [ClientIPScopedRateThrottle]
    throttle_scope = 'speech_session'

    @extend_schema(
        request=SpeechSessionRequestSerializer,
        responses={201: OpenApiTypes.OBJECT, 404: OpenApiTypes.OBJECT, 503: OpenApiTypes.OBJECT},
        tags=['speech'],
    )
    def post(self, request):
        serializer = SpeechSessionRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        post = published_blog_post_for_speech(data['source_public_id'])
        if post is None:
            return Response(
                {'code': 'speech_source_not_found', 'detail': 'Không tìm thấy bài viết.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        try:
            session = create_blog_post_speech_session(
                post=post,
                voice_id=data['voice_id'],
                style=data['style'],
            )
        except SpeechServiceRejected:
            return Response(
                {'code': 'speech_request_rejected', 'detail': 'Yêu cầu giọng đọc không hợp lệ.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except SpeechServiceUnavailable:
            return _unavailable_response()

        response = Response(session, status=status.HTTP_201_CREATED)
        response['Cache-Control'] = 'no-store'
        return response
