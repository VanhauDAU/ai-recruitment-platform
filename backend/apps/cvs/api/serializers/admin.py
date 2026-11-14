"""Serializer CV ứng viên cho admin: metadata, không có nội dung, email hay tiêu đề do
ứng viên đặt (có thể chứa họ tên)."""

from rest_framework import serializers

from ...models import UserCv


class AdminUserCvSerializer(serializers.ModelSerializer):
    candidate_public_id = serializers.CharField(source='user.public_id', read_only=True)
    template_name = serializers.CharField(source='template.name', read_only=True, default='')
    application_count = serializers.IntegerField(read_only=True)
    import_status = serializers.SerializerMethodField()
    import_failure_code = serializers.SerializerMethodField()
    is_locked = serializers.SerializerMethodField()

    class Meta:
        model = UserCv
        fields = [
            'public_id',
            'candidate_public_id',
            'template_name',
            'language',
            'cv_type',
            'source',
            'lifecycle_status',
            'processing_status',
            'import_status',
            'import_failure_code',
            'application_count',
            'is_locked',
            'moderation_lock_reason',
            'moderation_locked_at',
            'created_at',
            'updated_at',
        ]
        read_only_fields = fields

    def _import_job(self, obj):
        try:
            return obj.import_job
        except UserCv.import_job.RelatedObjectDoesNotExist:
            return None

    def get_import_status(self, obj):
        job = self._import_job(obj)
        return job.status if job else ''

    def get_import_failure_code(self, obj):
        job = self._import_job(obj)
        return job.failure_code if job else ''

    def get_is_locked(self, obj):
        return obj.moderation_locked_at is not None


class AdminCvReasonSerializer(serializers.Serializer):
    reason = serializers.CharField(max_length=255)
