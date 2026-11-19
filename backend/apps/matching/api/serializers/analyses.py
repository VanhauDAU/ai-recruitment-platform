from rest_framework import serializers

from ...models import MatchAnalysis


class AnalysisRequestSerializer(serializers.Serializer):
    job = serializers.SlugField(max_length=255, help_text='Slug của tin tuyển dụng.')
    cv = serializers.CharField(max_length=50, help_text='public_id của CV.')


class AnalysisErrorSerializer(serializers.Serializer):
    code = serializers.CharField()
    detail = serializers.CharField()


class AnalysisSerializer(serializers.ModelSerializer):
    """Trạng thái và kết quả một lần phân tích; `result` chỉ có khi đã hoàn tất."""

    job = serializers.CharField(source='job.slug', read_only=True)
    cv = serializers.SerializerMethodField()
    result = serializers.SerializerMethodField()
    cached = serializers.SerializerMethodField()

    class Meta:
        model = MatchAnalysis
        fields = [
            'public_id',
            'status',
            'job',
            'cv',
            'overall_score',
            'result',
            'error_code',
            'cached',
            'created_at',
            'completed_at',
        ]
        read_only_fields = fields

    def get_cv(self, analysis) -> dict:
        cv = analysis.cv_version.cv
        return {'public_id': cv.public_id, 'title': cv.title}

    def get_result(self, analysis) -> dict | None:
        return analysis.result_json if analysis.status == MatchAnalysis.Status.SUCCEEDED else None

    def get_cached(self, analysis) -> bool:
        return bool(self.context.get('cached'))
