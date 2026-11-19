from django.utils.translation import gettext, gettext_lazy
from rest_framework import serializers

from common.storage.media import media_url_from_value

from ...models import EmployerVerificationCase, RecruiterProfile
from ...services import MEMBER_REMOVAL_BLOCKERS

VERIFICATION_LABELS = {
    '': gettext_lazy('Chưa nộp hồ sơ xác thực'),
    EmployerVerificationCase.Status.DRAFT: gettext_lazy('Chưa nộp hồ sơ xác thực'),
    EmployerVerificationCase.Status.PENDING: gettext_lazy('Đang chờ duyệt'),
    EmployerVerificationCase.Status.IN_REVIEW: gettext_lazy('Đang được xem xét'),
    EmployerVerificationCase.Status.CHANGES_REQUESTED: gettext_lazy('Cần bổ sung giấy tờ'),
    EmployerVerificationCase.Status.APPROVED: gettext_lazy('Đã xác thực'),
    EmployerVerificationCase.Status.REJECTED: gettext_lazy('Bị từ chối'),
    EmployerVerificationCase.Status.REVOKED: gettext_lazy('Đã bị thu hồi'),
    EmployerVerificationCase.Status.EXPIRED: gettext_lazy('Đã hết hiệu lực'),
}


def _mask_email(email):
    local, _, domain = (email or '').partition('@')
    return f'{local[:2]}***@{domain}' if domain else ''


def _mask_phone(phone):
    digits = (phone or '').strip()
    return f'{digits[:3]}****{digits[-3:]}' if len(digits) >= 7 else ''


class CompanyMemberSerializer(serializers.ModelSerializer):
    """One member as the company manager sees and manages it."""

    member_id = serializers.CharField(source='public_id', read_only=True)
    display_name = serializers.SerializerMethodField()
    avatar_url = serializers.SerializerMethodField()
    email_masked = serializers.SerializerMethodField()
    phone_masked = serializers.SerializerMethodField()
    role = serializers.SerializerMethodField()
    role_label = serializers.SerializerMethodField()
    verification_status = serializers.SerializerMethodField()
    verification_label = serializers.SerializerMethodField()
    is_verified = serializers.BooleanField(source='is_verified_representative', read_only=True)
    has_compliance_hold = serializers.BooleanField(read_only=True)
    page_editor_grant_id = serializers.SerializerMethodField()
    joined_at = serializers.SerializerMethodField()
    approved_by_name = serializers.SerializerMethodField()
    job_count = serializers.IntegerField(read_only=True)
    active_job_count = serializers.IntegerField(read_only=True)
    unanswered_application_count = serializers.IntegerField(read_only=True)
    open_campaign_count = serializers.IntegerField(read_only=True)
    is_me = serializers.SerializerMethodField()
    can_transfer = serializers.SerializerMethodField()
    can_grant_page_editor = serializers.SerializerMethodField()
    can_receive_jobs = serializers.SerializerMethodField()
    removal_blockers = serializers.SerializerMethodField()

    class Meta:
        model = RecruiterProfile
        fields = [
            'member_id',
            'display_name',
            'avatar_url',
            'position_title',
            'email_masked',
            'phone_masked',
            'role',
            'role_label',
            'verification_status',
            'verification_label',
            'is_verified',
            'has_compliance_hold',
            'page_editor_grant_id',
            'joined_at',
            'approved_by_name',
            'job_count',
            'active_job_count',
            'unanswered_application_count',
            'open_campaign_count',
            'is_me',
            'can_transfer',
            'can_grant_page_editor',
            'can_receive_jobs',
            'removal_blockers',
        ]
        read_only_fields = fields

    def _is_manager(self, obj):
        return obj.company_role == RecruiterProfile.CompanyRole.OWNER

    def get_display_name(self, obj) -> str:
        return obj.user.full_name or _mask_email(obj.user.email)

    def get_avatar_url(self, obj) -> str:
        return media_url_from_value(obj.user.avatar_url, request=self.context.get('request')) or ''

    def get_email_masked(self, obj) -> str:
        return _mask_email(obj.user.email)

    def get_phone_masked(self, obj) -> str:
        return _mask_phone(obj.contact_phone or obj.user.phone)

    def get_role(self, obj) -> str:
        return 'manager' if self._is_manager(obj) else 'member'

    def get_role_label(self, obj) -> str:
        return gettext('Quản lý công ty') if self._is_manager(obj) else gettext('Thành viên')

    def get_verification_status(self, obj) -> str:
        case = getattr(obj, 'verification_case', None)
        return case.status if case is not None else ''

    def get_verification_label(self, obj) -> str:
        return str(
            VERIFICATION_LABELS.get(
                self.get_verification_status(obj), gettext('Chưa nộp hồ sơ xác thực')
            )
        )

    def get_page_editor_grant_id(self, obj) -> str | None:
        grant = next(iter(obj.active_page_grants), None)
        return grant.public_id if grant else None

    def get_joined_at(self, obj) -> str | None:
        joined = obj.joined_at or (obj.created_at if self._is_manager(obj) else None)
        return serializers.DateTimeField().to_representation(joined) if joined else None

    def get_approved_by_name(self, obj) -> str:
        return obj.approved_by_name or ''

    def get_is_me(self, obj) -> bool:
        return obj.user_id == self.context['request'].user.pk

    def get_can_transfer(self, obj) -> bool:
        return not self._is_manager(obj) and obj.is_verified_representative

    def get_can_grant_page_editor(self, obj) -> bool:
        return (
            not self._is_manager(obj)
            and obj.is_verified_representative
            and not obj.has_compliance_hold
        )

    def get_can_receive_jobs(self, obj) -> bool:
        return bool(obj.is_verified_representative and not obj.has_compliance_hold)

    def get_removal_blockers(self, obj) -> list[str]:
        """Same rules as the removal service, read from the list annotations."""
        if self._is_manager(obj):
            return [gettext('Hãy chuyển quyền quản lý trước khi rời vai trò này')]
        found = {
            'ACTIVE_JOBS_EXIST': obj.active_job_count,
            'OPEN_CAMPAIGNS_EXIST': obj.open_campaign_count,
            'COMPLIANCE_HOLDS_EXIST': obj.has_compliance_hold,
        }
        return [str(MEMBER_REMOVAL_BLOCKERS[code]) for code, present in found.items() if present]


class FormerCompanyMemberSerializer(serializers.ModelSerializer):
    """Someone who left the company but still holds jobs or campaigns there."""

    member_id = serializers.CharField(source='public_id', read_only=True)
    display_name = serializers.SerializerMethodField()
    avatar_url = serializers.SerializerMethodField()
    email_masked = serializers.SerializerMethodField()
    left_at = serializers.DateTimeField(read_only=True)
    job_count = serializers.IntegerField(read_only=True)
    active_job_count = serializers.IntegerField(read_only=True)
    unanswered_application_count = serializers.IntegerField(read_only=True)
    open_campaign_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = RecruiterProfile
        fields = [
            'member_id',
            'display_name',
            'avatar_url',
            'position_title',
            'email_masked',
            'left_at',
            'job_count',
            'active_job_count',
            'unanswered_application_count',
            'open_campaign_count',
        ]
        read_only_fields = fields

    def get_display_name(self, obj) -> str:
        return obj.user.full_name or _mask_email(obj.user.email)

    def get_avatar_url(self, obj) -> str:
        return media_url_from_value(obj.user.avatar_url, request=self.context.get('request')) or ''

    def get_email_masked(self, obj) -> str:
        return _mask_email(obj.user.email)
