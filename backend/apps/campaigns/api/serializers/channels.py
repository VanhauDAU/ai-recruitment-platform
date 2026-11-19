from django.utils.translation import gettext as _
from rest_framework import serializers

from apps.jobs.models import Job

from ...models import CampaignChannel, CampaignChannelCost
from ...services import channel_link, render_content


class ChannelCostSerializer(serializers.ModelSerializer):
    class Meta:
        model = CampaignChannelCost
        fields = ['id', 'amount', 'incurred_on', 'note', 'created_at']
        read_only_fields = ['id', 'created_at']

    def validate_amount(self, value):
        if value < 1:
            raise serializers.ValidationError(_('Chi phí phải lớn hơn 0.'))
        return value


class CampaignChannelSerializer(serializers.ModelSerializer):
    kind_label = serializers.CharField(source='get_kind_display', read_only=True)
    job = serializers.SlugRelatedField(
        slug_field='public_id',
        queryset=Job.objects.all(),
        required=False,
        allow_null=True,
    )
    job_title = serializers.CharField(source='job.title', read_only=True, default='')
    link = serializers.SerializerMethodField()
    rendered_content = serializers.SerializerMethodField()
    posted = serializers.BooleanField(write_only=True, required=False)
    clicks = serializers.IntegerField(read_only=True, default=0)
    unique_clicks = serializers.IntegerField(read_only=True, default=0)
    applications = serializers.IntegerField(source='application_count', read_only=True, default=0)
    hires = serializers.IntegerField(source='hire_count', read_only=True, default=0)
    cost = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = CampaignChannel
        fields = [
            'public_id',
            'kind',
            'kind_label',
            'label',
            'target',
            'job',
            'job_title',
            'link',
            'content',
            'content_source',
            'rendered_content',
            'posted',
            'posted_at',
            'posted_url',
            'clicks',
            'unique_clicks',
            'applications',
            'hires',
            'cost',
            'created_at',
        ]
        read_only_fields = ['public_id', 'content_source', 'posted_at', 'created_at']

    def get_link(self, obj) -> str:
        return channel_link(obj)

    def get_rendered_content(self, obj) -> dict:
        return render_content(obj)


class CampaignChannelCreateSerializer(serializers.ModelSerializer):
    job = serializers.SlugRelatedField(
        slug_field='public_id', queryset=Job.objects.all(), required=False, allow_null=True
    )

    class Meta:
        model = CampaignChannel
        fields = ['kind', 'label', 'target', 'job']
