from rest_framework import serializers

from apps.privacy.models import DataSubjectRequest
from apps.privacy.services import NOTE_MAX_LENGTH, export_available_until


class DataRequestSerializer(serializers.ModelSerializer):
    kind_label = serializers.CharField(source='get_kind_display', read_only=True)
    status_label = serializers.CharField(source='get_status_display', read_only=True)
    export_available_until = serializers.SerializerMethodField()

    class Meta:
        model = DataSubjectRequest
        fields = [
            'public_id',
            'kind',
            'kind_label',
            'status',
            'status_label',
            'note',
            'resolution_note',
            'created_at',
            'handled_at',
            'export_available_until',
        ]
        read_only_fields = fields

    def get_export_available_until(self, obj) -> str | None:
        until = export_available_until(obj)
        return until.isoformat() if until else None


class DataRequestCreateSerializer(serializers.Serializer):
    kind = serializers.ChoiceField(choices=DataSubjectRequest.Kind.choices)
    note = serializers.CharField(
        required=False, allow_blank=True, max_length=NOTE_MAX_LENGTH, default=''
    )


class DataRequestAccountSerializer(serializers.Serializer):
    public_id = serializers.CharField()
    email = serializers.EmailField()
    full_name = serializers.CharField()
    role = serializers.CharField()
    is_deleted = serializers.BooleanField()


class AdminDataRequestSerializer(DataRequestSerializer):
    account = DataRequestAccountSerializer(source='user', read_only=True)
    handled_by_email = serializers.EmailField(
        source='handled_by.email', read_only=True, allow_null=True, default=None
    )

    class Meta(DataRequestSerializer.Meta):
        fields = [*DataRequestSerializer.Meta.fields, 'account', 'handled_by_email']
        read_only_fields = fields


class AdminDataRequestQuerySerializer(serializers.Serializer):
    status = serializers.ChoiceField(
        choices=DataSubjectRequest.Status.choices, required=False, allow_blank=True
    )
    kind = serializers.ChoiceField(
        choices=DataSubjectRequest.Kind.choices, required=False, allow_blank=True
    )


class AdminDataRequestDecisionSerializer(serializers.Serializer):
    note = serializers.CharField(required=False, allow_blank=True, max_length=NOTE_MAX_LENGTH)
