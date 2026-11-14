from rest_framework import serializers

from .companies import PublicCompanyListSerializer


class CompanyFollowWriteSerializer(serializers.Serializer):
    # allow_null keeps "key absent" distinct from False for form bodies too:
    # DRF otherwise reads a missing boolean of an HTML form as False.
    notify_new_jobs = serializers.BooleanField(required=False, allow_null=True)


class FollowedCompanySerializer(PublicCompanyListSerializer):
    """Directory card of a followed company plus the candidate's own follow."""

    followed_at = serializers.DateTimeField(read_only=True)
    notify_new_jobs = serializers.BooleanField(read_only=True)

    class Meta(PublicCompanyListSerializer.Meta):
        fields = [*PublicCompanyListSerializer.Meta.fields, 'followed_at', 'notify_new_jobs']
        read_only_fields = fields
