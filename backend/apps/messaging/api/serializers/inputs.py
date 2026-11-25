"""Kiểm tra đầu vào của ProCV Connect; dữ liệu trả về dựng ở ``services.presenters``."""

from django.utils.translation import gettext_lazy
from rest_framework import serializers

from ...domain import INTERVIEW_ACTIONS, MAX_BODY_CHARS
from ...models import InterviewAppointment, Message


class ConversationQuerySerializer(serializers.Serializer):
    q = serializers.CharField(required=False, allow_blank=True, max_length=100)
    page = serializers.IntegerField(required=False, min_value=1)


class StartCandidateConversationSerializer(serializers.Serializer):
    job = serializers.CharField(max_length=50)


class StartRecruiterConversationSerializer(serializers.Serializer):
    application = serializers.CharField(max_length=50, required=False, allow_blank=True)
    invitation = serializers.CharField(max_length=50, required=False, allow_blank=True)

    def validate(self, attrs):
        if bool(attrs.get('application')) == bool(attrs.get('invitation')):
            raise serializers.ValidationError(
                gettext_lazy('Chọn đúng một hồ sơ ứng tuyển hoặc một lời mời kết nối.')
            )
        return attrs


class MessagesQuerySerializer(serializers.Serializer):
    before = serializers.IntegerField(required=False, min_value=1)
    after = serializers.IntegerField(required=False, min_value=0)
    limit = serializers.IntegerField(required=False, min_value=1, max_value=50, default=30)


class SendMessageSerializer(serializers.Serializer):
    client_id = serializers.UUIDField(required=False, allow_null=True)
    kind = serializers.ChoiceField(
        choices=[Message.Kind.TEXT, Message.Kind.JOB, Message.Kind.CV], default=Message.Kind.TEXT
    )
    body = serializers.CharField(
        required=False, allow_blank=True, trim_whitespace=False, max_length=MAX_BODY_CHARS * 2
    )
    job = serializers.CharField(required=False, allow_blank=True, max_length=50)
    cv = serializers.CharField(required=False, allow_blank=True, max_length=50)


class SendFileSerializer(serializers.Serializer):
    client_id = serializers.UUIDField(required=False, allow_null=True)
    file = serializers.FileField()


class ReadSerializer(serializers.Serializer):
    seq = serializers.IntegerField(min_value=0)


class InterviewCreateSerializer(serializers.Serializer):
    starts_at = serializers.DateTimeField()
    duration_minutes = serializers.IntegerField(min_value=15, max_value=480, default=60)
    mode = serializers.ChoiceField(choices=InterviewAppointment.Mode.choices)
    location = serializers.CharField(required=False, allow_blank=True, max_length=255, default='')
    meeting_url = serializers.URLField(required=False, allow_blank=True, max_length=500, default='')
    note = serializers.CharField(required=False, allow_blank=True, max_length=2000, default='')


class InterviewRespondSerializer(serializers.Serializer):
    action = serializers.ChoiceField(choices=INTERVIEW_ACTIONS)
    note = serializers.CharField(required=False, allow_blank=True, max_length=1000, default='')


class InterviewCancelSerializer(serializers.Serializer):
    note = serializers.CharField(required=False, allow_blank=True, max_length=1000, default='')


class BlockSerializer(serializers.Serializer):
    blocked = serializers.BooleanField()
