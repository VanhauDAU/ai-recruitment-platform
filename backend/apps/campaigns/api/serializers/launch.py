from rest_framework import serializers


class LaunchSelectionSerializer(serializers.Serializer):
    publish_job_ids = serializers.ListField(
        child=serializers.CharField(max_length=50), required=False, default=list, max_length=50
    )
    attach_job_ids = serializers.ListField(
        child=serializers.CharField(max_length=50), required=False, default=list, max_length=50
    )


class LaunchRequestSerializer(serializers.Serializer):
    mode = serializers.ChoiceField(choices=('now', 'scheduled'))
    accepted_statement_version = serializers.CharField(max_length=20)
