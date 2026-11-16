from rest_framework import serializers

from ...models import CompanyJoinRequest


class CompanyJoinRequestSerializer(serializers.ModelSerializer):
    company_public_id = serializers.CharField(source='company.public_id', read_only=True)
    company_name = serializers.CharField(source='company.company_name', read_only=True)
    requester_name = serializers.SerializerMethodField()
    requester_email = serializers.EmailField(source='recruiter.user.email', read_only=True)
    requester_position = serializers.CharField(source='recruiter.position_title', read_only=True)
    # Pending and the company has no eligible owner: an administrator decides.
    awaiting_admin = serializers.SerializerMethodField()
    # Whether the caller may approve or reject it now (owner list only).
    can_decide = serializers.SerializerMethodField()

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
            'awaiting_admin',
            'can_decide',
            'created_at',
            'decided_at',
        ]
        read_only_fields = fields

    def get_requester_name(self, obj) -> str:
        return obj.recruiter.user.full_name or obj.recruiter.user.email

    def get_awaiting_admin(self, obj) -> bool:
        has_owner = getattr(obj, 'has_eligible_owner', True)
        return obj.status == CompanyJoinRequest.Status.PENDING and not has_owner

    def get_can_decide(self, obj) -> bool:
        return bool(self.context.get('can_decide', False))


class AdminCompanyJoinRequestSerializer(CompanyJoinRequestSerializer):
    requester_public_id = serializers.CharField(source='recruiter.user.public_id', read_only=True)
    decided_by_name = serializers.SerializerMethodField()

    class Meta(CompanyJoinRequestSerializer.Meta):
        fields = [
            *CompanyJoinRequestSerializer.Meta.fields,
            'requester_public_id',
            'decided_by_name',
        ]
        read_only_fields = fields

    def get_can_decide(self, obj) -> bool:
        return self.get_awaiting_admin(obj)

    def get_decided_by_name(self, obj) -> str:
        user = obj.decided_by
        return (user.full_name or user.email) if user else ''
