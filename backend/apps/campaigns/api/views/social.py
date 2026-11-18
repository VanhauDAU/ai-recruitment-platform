import logging
from urllib.parse import urlencode

from django.conf import settings
from django.http import HttpResponseRedirect
from django.shortcuts import get_object_or_404
from django.views import View
from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsEmployer
from apps.employers.services import ensure_recruiter_job_workspace

from ...models import ScheduledSocialPost, SocialAccountConnection
from ...services import (
    cancel_post,
    complete_page_connection,
    disconnect_page,
    pending_pages,
    reschedule_post,
    schedule_post,
    select_page,
    start_page_connection,
)
from ...services.social import SocialProviderError
from ..serializers.social import (
    ReschedulePostSerializer,
    ScheduledPostSerializer,
    SchedulePostSerializer,
    SelectPageSerializer,
    SocialConnectionSerializer,
)
from .channels import CampaignScopedView

logger = logging.getLogger(__name__)


def integrations_url(**query):
    base = (
        f'{settings.EMPLOYER_FRONTEND_URL.rstrip("/")}/tuyendung/app/account/settings/integrations'
    )
    return f'{base}?{urlencode(query)}' if query else base


class SocialConnectStartView(APIView):
    permission_classes = [IsEmployer]

    def post(self, request):
        ensure_recruiter_job_workspace(request.user)
        return Response({'url': start_page_connection(request.user)})


class FacebookCallbackView(View):
    """Browser redirect from Facebook; the signed state identifies the recruiter."""

    def get(self, request):
        code, state = request.GET.get('code'), request.GET.get('state', '')
        if not code:
            return HttpResponseRedirect(integrations_url(fb_error='denied'))
        try:
            nonce = complete_page_connection(code=code, state=state)
        except ValidationError:
            return HttpResponseRedirect(integrations_url(fb_error='expired'))
        except SocialProviderError as error:
            logger.warning('facebook_connect_failed', extra={'code': error.code})
            return HttpResponseRedirect(integrations_url(fb_error='provider'))
        return HttpResponseRedirect(integrations_url(fb_select=nonce))


class SocialPendingPagesView(APIView):
    permission_classes = [IsEmployer]

    def get(self, request, nonce):
        return Response(pending_pages(request.user, nonce))

    def post(self, request, nonce):
        serializer = SelectPageSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        connection = select_page(user=request.user, nonce=nonce, **serializer.validated_data)
        return Response(SocialConnectionSerializer(connection).data, status=status.HTTP_201_CREATED)


class SocialConnectionListView(APIView):
    permission_classes = [IsEmployer]

    def get(self, request):
        connections = SocialAccountConnection.objects.filter(owner__user=request.user).exclude(
            status=SocialAccountConnection.Status.REVOKED
        )
        return Response(SocialConnectionSerializer(connections, many=True).data)


class SocialConnectionDetailView(APIView):
    permission_classes = [IsEmployer]

    def delete(self, request, connection_id):
        connection = get_object_or_404(
            SocialAccountConnection, owner__user=request.user, public_id=connection_id
        )
        disconnect_page(user=request.user, connection=connection)
        return Response(status=status.HTTP_204_NO_CONTENT)


class ChannelPostListView(CampaignScopedView):
    def get(self, request, public_id, channel_id):
        posts = ScheduledSocialPost.objects.filter(channel=self.channel()).select_related(
            'connection'
        )
        return Response(ScheduledPostSerializer(posts, many=True).data)

    def post(self, request, public_id, channel_id):
        channel = self.channel()
        serializer = SchedulePostSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        post = schedule_post(channel=channel, user=request.user, **serializer.validated_data)
        return Response(ScheduledPostSerializer(post).data, status=status.HTTP_201_CREATED)


class ChannelPostDetailView(CampaignScopedView):
    def _post(self):
        return get_object_or_404(
            ScheduledSocialPost.objects.select_related('channel__campaign__owner', 'connection'),
            channel=self.channel(),
            public_id=self.kwargs['post_id'],
        )

    def patch(self, request, public_id, channel_id, post_id):
        serializer = ReschedulePostSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        post = reschedule_post(post=self._post(), user=request.user, **serializer.validated_data)
        return Response(ScheduledPostSerializer(post).data)

    def delete(self, request, public_id, channel_id, post_id):
        cancel_post(post=self._post(), user=request.user)
        return Response(status=status.HTTP_204_NO_CONTENT)
