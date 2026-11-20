import logging
from urllib.parse import urlencode

from django.conf import settings
from django.http import Http404, HttpResponseRedirect
from django.shortcuts import get_object_or_404
from django.utils.translation import gettext as _
from django.views import View
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import serializers, status
from rest_framework.exceptions import ValidationError
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle
from rest_framework.views import APIView

from apps.accounts.api.permissions import IsEmployer
from apps.employers.services import ensure_recruiter_job_workspace

from ...domain.social_networks import FACEBOOK_PAGE, NETWORKS
from ...selectors import (
    active_social_connections_queryset,
    channel_posts_queryset,
    recruiter_social_connections_queryset,
)
from ...services import (
    cancel_post,
    company_post_images,
    complete_connection,
    disconnect_account,
    pending_accounts,
    reschedule_post,
    save_post_image,
    schedule_post,
    select_account,
    start_connection,
)
from ...services.social import SocialProviderError, is_live
from ..serializers.social import (
    ReschedulePostSerializer,
    ScheduledPostSerializer,
    SchedulePostSerializer,
    SelectAccountSerializer,
    SocialConnectionSerializer,
    SocialNetworkSerializer,
)
from .channels import CampaignScopedView

logger = logging.getLogger(__name__)


def integrations_url(**query):
    base = (
        f'{settings.EMPLOYER_FRONTEND_URL.rstrip("/")}/tuyendung/app/account/settings/integrations'
    )
    return f'{base}?{urlencode(query)}' if query else base


def _network(network):
    if network not in NETWORKS:
        raise Http404
    return network


@extend_schema(
    tags=['campaigns'],
    summary='Các mạng xã hội kết nối được và giới hạn bài đăng của từng mạng',
    responses=SocialNetworkSerializer(many=True),
)
class SocialNetworkListView(APIView):
    permission_classes = [IsEmployer]

    def get(self, request):
        networks = [
            {
                'key': network.key,
                'platform': network.platform,
                'label': network.label,
                'channel_kind': network.channel_kind,
                'capabilities': vars(network.capabilities),
                'simulated': not is_live(network.key),
            }
            for network in NETWORKS.values()
        ]
        return Response(SocialNetworkSerializer(networks, many=True).data)


@extend_schema(
    tags=['campaigns'],
    summary='Bắt đầu kết nối tài khoản mạng xã hội (trả URL đăng nhập của mạng)',
    request=None,
    responses=inline_serializer('SocialConnectStart', {'url': serializers.URLField()}),
)
class SocialConnectStartView(APIView):
    permission_classes = [IsEmployer]

    def post(self, request, network):
        ensure_recruiter_job_workspace(request.user)
        return Response({'url': start_connection(request.user, _network(network))})


class SocialCallbackView(View):
    """Browser redirect from the network; the signed state identifies the recruiter."""

    def get(self, request, network=FACEBOOK_PAGE):  # legacy route passes no network
        network = _network(network)
        code, state = request.GET.get('code'), request.GET.get('state', '')
        if not code:
            return HttpResponseRedirect(integrations_url(network=network, social_error='denied'))
        try:
            nonce = complete_connection(network=network, code=code, state=state)
        except ValidationError:
            return HttpResponseRedirect(integrations_url(network=network, social_error='expired'))
        except SocialProviderError as error:
            logger.warning('social_connect_failed', extra={'network': network, 'code': error.code})
            return HttpResponseRedirect(integrations_url(network=network, social_error='provider'))
        return HttpResponseRedirect(integrations_url(network=network, social_select=nonce))


@extend_schema(tags=['campaigns'])
class SocialPendingAccountsView(APIView):
    permission_classes = [IsEmployer]

    @extend_schema(
        summary='Các tài khoản chờ chọn sau khi đăng nhập mạng xã hội',
        responses=OpenApiTypes.OBJECT,
    )
    def get(self, request, network, nonce):
        return Response(pending_accounts(request.user, _network(network), nonce))

    @extend_schema(
        summary='Chọn tài khoản để kết nối',
        request=SelectAccountSerializer,
        responses={201: SocialConnectionSerializer},
    )
    def post(self, request, network, nonce):
        serializer = SelectAccountSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        connection = select_account(
            user=request.user,
            network=_network(network),
            nonce=nonce,
            **serializer.validated_data,
        )
        return Response(SocialConnectionSerializer(connection).data, status=status.HTTP_201_CREATED)


@extend_schema(
    tags=['campaigns'],
    summary='Các tài khoản mạng xã hội đã kết nối',
    responses=SocialConnectionSerializer(many=True),
)
class SocialConnectionListView(APIView):
    permission_classes = [IsEmployer]

    def get(self, request):
        connections = active_social_connections_queryset(request.user)
        return Response(SocialConnectionSerializer(connections, many=True).data)


@extend_schema(
    tags=['campaigns'], summary='Ngắt kết nối tài khoản mạng xã hội', responses={204: None}
)
class SocialConnectionDetailView(APIView):
    permission_classes = [IsEmployer]

    def delete(self, request, connection_id):
        connection = get_object_or_404(
            recruiter_social_connections_queryset(request.user), public_id=connection_id
        )
        disconnect_account(user=request.user, connection=connection)
        return Response(status=status.HTTP_204_NO_CONTENT)


@extend_schema(tags=['campaigns'])
class ChannelPostListView(CampaignScopedView):
    @extend_schema(summary='Bài tự đăng của kênh', responses=ScheduledPostSerializer(many=True))
    def get(self, request, public_id, channel_id):
        posts = channel_posts_queryset(self.channel())
        return Response(
            ScheduledPostSerializer(posts, many=True, context={'request': request}).data
        )

    @extend_schema(
        summary='Lên lịch một bài tự đăng',
        request=SchedulePostSerializer,
        responses={201: ScheduledPostSerializer},
    )
    def post(self, request, public_id, channel_id):
        channel = self.channel()
        serializer = SchedulePostSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        post = schedule_post(channel=channel, user=request.user, **serializer.validated_data)
        return Response(
            ScheduledPostSerializer(post, context={'request': request}).data,
            status=status.HTTP_201_CREATED,
        )


@extend_schema(tags=['campaigns'])
class ChannelPostDetailView(CampaignScopedView):
    def _post(self):
        return get_object_or_404(
            channel_posts_queryset(self.channel()), public_id=self.kwargs['post_id']
        )

    @extend_schema(
        summary='Đổi giờ đăng',
        request=ReschedulePostSerializer,
        responses=ScheduledPostSerializer,
    )
    def patch(self, request, public_id, channel_id, post_id):
        serializer = ReschedulePostSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        post = reschedule_post(post=self._post(), user=request.user, **serializer.validated_data)
        return Response(ScheduledPostSerializer(post, context={'request': request}).data)

    @extend_schema(summary='Hủy bài đăng đã lên lịch', responses={204: None})
    def delete(self, request, public_id, channel_id, post_id):
        cancel_post(post=self._post(), user=request.user)
        return Response(status=status.HTTP_204_NO_CONTENT)


class PostImageThrottle(UserRateThrottle):
    rate = '60/hour'


@extend_schema(tags=['campaigns'])
class ChannelPostImageView(CampaignScopedView):
    """Upload an image for a social post, or list the company's ready-made images."""

    parser_classes = [MultiPartParser]

    def get_throttles(self):
        return [PostImageThrottle()] if self.request.method == 'POST' else super().get_throttles()

    @extend_schema(summary='Ảnh có sẵn của công ty', responses=OpenApiTypes.OBJECT)
    def get(self, request, public_id, channel_id):
        return Response({'company_images': company_post_images(self.campaign())})

    @extend_schema(
        summary='Tải ảnh cho bài tự đăng',
        request={
            'multipart/form-data': inline_serializer(
                'ChannelPostImageUpload', {'file': serializers.ImageField()}
            )
        },
        responses={201: OpenApiTypes.OBJECT},
    )
    def post(self, request, public_id, channel_id):
        upload = request.FILES.get('file')
        if upload is None:
            raise ValidationError({'file': _('Chọn một ảnh.')})
        saved = save_post_image(channel=self.channel(), user=request.user, upload=upload)
        return Response(saved, status=status.HTTP_201_CREATED)
