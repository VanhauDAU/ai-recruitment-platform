from rest_framework import serializers

from ...models import Company, RecruiterProfile


def _masked_tax_code(value):
    if not value:
        return ''
    return f'***{value[-4:]}' if len(value) > 4 else '****'


class AdminCompanyListSerializer(serializers.ModelSerializer):
    business_type_label = serializers.CharField(source='get_business_type_display', read_only=True)
    verification_status_label = serializers.CharField(
        source='get_verification_status_display',
        read_only=True,
    )
    tax_code = serializers.SerializerMethodField()
    owners = serializers.SerializerMethodField()
    recruiter_count = serializers.IntegerField(read_only=True)
    owner_count = serializers.IntegerField(read_only=True)
    member_count = serializers.IntegerField(read_only=True)
    pending_update_count = serializers.IntegerField(read_only=True)
    recruiter_verification_summary = serializers.SerializerMethodField()

    class Meta:
        model = Company
        fields = [
            'public_id',
            'company_name',
            'trade_name',
            'logo_url',
            'business_type',
            'business_type_label',
            'tax_code',
            'verification_status',
            'verification_status_label',
            'owners',
            'recruiter_count',
            'owner_count',
            'member_count',
            'pending_update_count',
            'recruiter_verification_summary',
            'created_at',
            'updated_at',
        ]

    def get_tax_code(self, obj):
        if self.context.get('can_view_sensitive'):
            return obj.tax_code or ''
        return _masked_tax_code(obj.tax_code)

    def get_owners(self, obj):
        return [
            {
                'public_id': owner.public_id,
                'user_public_id': owner.user.public_id,
                'full_name': owner.user.full_name,
                'email': owner.user.email,
            }
            for owner in getattr(obj, 'admin_directory_owners', [])
        ]

    def get_recruiter_verification_summary(self, obj):
        return {
            'none': obj.unsubmitted_recruiter_count,
            'draft': obj.draft_recruiter_count,
            'pending': obj.pending_recruiter_count,
            'changes_requested': obj.changes_requested_recruiter_count,
            'approved': obj.approved_recruiter_count,
            'rejected': obj.rejected_recruiter_count,
        }


class AdminCompanyDetailSerializer(AdminCompanyListSerializer):
    company_size_label = serializers.CharField(source='get_company_size_display', read_only=True)
    email = serializers.SerializerMethodField()
    phone = serializers.SerializerMethodField()
    industries = serializers.SerializerMethodField()
    created_by = serializers.SerializerMethodField()
    images = serializers.SerializerMethodField()

    class Meta(AdminCompanyListSerializer.Meta):
        fields = [
            *AdminCompanyListSerializer.Meta.fields,
            'website_url',
            'email',
            'phone',
            'address',
            'company_size',
            'company_size_label',
            'description',
            'employee_benefits',
            'markets',
            'target_customers',
            'founded_year',
            'has_brand_page',
            'verified_at',
            'rejected_reason',
            'industries',
            'images',
            'created_by',
        ]

    def get_email(self, obj):
        return obj.email if self.context.get('can_view_sensitive') else ''

    def get_phone(self, obj):
        if self.context.get('can_view_sensitive'):
            return obj.phone
        return f'***{obj.phone[-3:]}' if obj.phone else ''

    def get_industries(self, obj):
        return [
            {
                'id': item.industry_id,
                'name': item.industry.name,
                'slug': item.industry.slug,
                'is_primary': item.is_primary,
            }
            for item in obj.company_industries.all()
        ]

    def get_created_by(self, obj):
        return {
            'public_id': obj.created_by.public_id,
            'full_name': obj.created_by.full_name,
            'email': obj.created_by.email,
        }

    def get_images(self, obj):
        return [
            {
                'id': image.id,
                'image_url': image.image_url,
                'caption': image.caption,
                'sort_order': image.sort_order,
            }
            for image in obj.images.all()
        ]


class AdminCompanyRecruiterSerializer(serializers.ModelSerializer):
    account = serializers.SerializerMethodField()
    company_role_label = serializers.CharField(source='get_company_role_display', read_only=True)
    contact_phone = serializers.SerializerMethodField()
    phone_verified = serializers.BooleanField(source='phone_verified_at', read_only=True)
    onboarding_completed = serializers.BooleanField(
        source='onboarding_completed_at',
        read_only=True,
    )
    verification = serializers.SerializerMethodField()

    class Meta:
        model = RecruiterProfile
        fields = [
            'public_id',
            'account',
            'company_role',
            'company_role_label',
            'position_title',
            'contact_phone',
            'phone_verified',
            'registration_completed_at',
            'onboarding_completed',
            'verification',
            'created_at',
            'updated_at',
        ]

    def get_account(self, obj):
        return {
            'public_id': obj.user.public_id,
            'full_name': obj.user.full_name,
            'email': obj.user.email,
            'status': obj.user.status,
            'email_verified': obj.user.email_verified,
            'is_deleted': obj.user.is_deleted,
        }

    def get_contact_phone(self, obj):
        value = obj.verified_phone or obj.contact_phone or ''
        if self.context.get('can_view_account_sensitive'):
            return value
        return f'***{value[-3:]}' if value else ''

    def get_verification(self, obj):
        case = getattr(obj, 'verification_case', None)
        if case is None:
            return {
                'public_id': None,
                'status': 'none',
                'status_label': 'Chưa có hồ sơ',
                'verification_method': '',
                'verification_method_label': '',
                'submitted_at': None,
                'decided_at': None,
            }
        return {
            'public_id': case.public_id,
            'status': case.status,
            'status_label': case.get_status_display(),
            'verification_method': case.verification_method,
            'verification_method_label': case.get_verification_method_display(),
            'submitted_at': case.submitted_at,
            'decided_at': case.decided_at,
        }
