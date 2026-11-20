from django.utils.translation import gettext as _
from rest_framework import serializers

from apps.jobs.models import Job

from ...models import CampaignChannel, CampaignChannelCost
from ...services import COMPANY_SEGMENT, channel_link, post_link, render_content


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
    jobs = serializers.SlugRelatedField(
        slug_field='public_id', queryset=Job.objects.all(), many=True, required=False
    )
    link = serializers.SerializerMethodField()
    links = serializers.SerializerMethodField()
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
            'jobs',
            'link',
            'links',
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
        return post_link(obj)

    def get_links(self, obj) -> list:
        """Every tracked link of the channel: landing, company page, then one per open job.

        The view passes the campaign's open jobs as ``context['campaign_jobs']``.
        """
        links = [
            {
                'key': 'landing',
                'label': _('Trang tuyển dụng của chiến dịch'),
                'url': channel_link(obj),
            },
            {
                'key': 'company',
                'label': _('Trang công ty'),
                'url': channel_link(obj, COMPANY_SEGMENT),
            },
        ]
        return links + [
            {'key': job.public_id, 'label': job.title, 'url': channel_link(obj, job.public_id)}
            for job in self.context.get('campaign_jobs', ())
        ]

    def get_rendered_content(self, obj) -> dict:
        return render_content(obj)


class CampaignChannelCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = CampaignChannel
        fields = ['kind', 'label']
