from rest_framework import serializers

from ...models import CompanyJoinRequest


class CompanyJoinRequestSerializer(serializers.ModelSerializer):
    company_public_id = serializers.CharField(source='company.public_id', read_only=True)
    company_name = serializers.CharField(source='company.company_name', read_only=True)
    requester_name = serializers.SerializerMethodField()
    requester_email = serializers.EmailField(source='recruiter.user.email', read_only=True)
    requester_position = serializers.CharField(source='recruiter.position_title', read_only=True)

    class Meta:
        model = CompanyJoinRequest
        fields = [
            'public_id',
            'status',
            'company_public_id',
            'company_name',
            'requester_name',
            'requester_email',
            'requester_position',
            'created_at',
            'decided_at',
        ]
        read_only_fields = fields

    def get_requester_name(self, obj):
        return obj.recruiter.user.full_name or obj.recruiter.user.email
