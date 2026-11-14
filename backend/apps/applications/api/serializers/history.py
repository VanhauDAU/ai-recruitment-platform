from rest_framework import serializers

from apps.candidates.models import CandidateNotification

from ...models import ApplicationStatusHistory


class CandidateNoticeSerializer(serializers.Serializer):
    state = serializers.ChoiceField(choices=['scheduled', 'delivered', 'superseded', 'undone'])
    deliver_at = serializers.DateTimeField()
    delivered_at = serializers.DateTimeField(allow_null=True)
    email_sent_at = serializers.DateTimeField(allow_null=True)


class ApplicationStatusHistorySerializer(serializers.ModelSerializer):
    """Expects rows from ``recruiter_application_history_queryset``."""

    changed_by_name = serializers.CharField(source='changed_by.full_name', read_only=True)
    candidate_notice = serializers.SerializerMethodField()
    can_undo = serializers.SerializerMethodField()

    class Meta:
        model = ApplicationStatusHistory
        fields = [
            'from_status',
            'to_status',
            'note',
            'changed_by_name',
            'created_at',
            'reverted_at',
            'candidate_notice',
            'can_undo',
        ]
        read_only_fields = fields

    @staticmethod
    def _notice_state(obj):
        if obj.notice_deliver_after is None:
            return None
        if obj.notice_delivered_at is not None:
            return 'delivered'
        if obj.notice_cancel_reason == CandidateNotification.CancelReason.SUPERSEDED:
            return 'superseded'
        if obj.notice_cancel_reason == CandidateNotification.CancelReason.UNDONE:
            return 'undone'
        return 'scheduled'

    def get_candidate_notice(self, obj):
        state = self._notice_state(obj)
        if state is None:
            return None
        return CandidateNoticeSerializer(
            {
                'state': state,
                'deliver_at': obj.notice_deliver_after,
                'delivered_at': obj.notice_delivered_at,
                'email_sent_at': obj.notice_email_sent_at,
            }
        ).data

    def get_can_undo(self, obj):
        # Mirrors undo_latest_status_change's guards so the button never lies.
        return bool(
            obj.pk == self.context.get('undoable_history_id')
            and self._notice_state(obj) == 'scheduled'
        )
