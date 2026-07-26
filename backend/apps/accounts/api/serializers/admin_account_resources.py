"""Role-aware contracts for lazily loaded admin account-detail sections."""

from django.core.exceptions import ObjectDoesNotExist
from rest_framework import serializers

from apps.applications.models import Application
from apps.candidates.models import CandidateConsent
from apps.cvs.models import UserCv
from apps.employers.models import RecruitmentCampaign, RecruitmentNeed
from apps.jobs.models import Job
from common.media_storage import media_url_from_value


def _masked(value, *, visible, keep=4):
    if visible or value in (None, ''):
        return value
    text = str(value)
    return f'***{text[-keep:]}' if len(text) > keep else '****'


class AdminAccountProfileSerializer(serializers.Serializer):
    """Complete business profile without exposing secrets or storage keys."""

    def to_representation(self, user):
        sensitive = self.context.get('can_view_sensitive', False)
        payload = {
            'account': {
                'public_id': user.public_id,
                'full_name': user.full_name,
                'email': user.email,
                'phone': _masked(user.phone, visible=sensitive),
                'role': user.role,
                'status': user.status,
            }
        }
        if user.is_candidate:
            payload['candidate'] = self._candidate(user, sensitive)
        elif user.is_employer:
            payload['employer'] = self._employer(user, sensitive)
        else:
            payload['admin'] = self._admin(user)
        return payload

    def _candidate(self, user, sensitive):
        try:
            profile = user.candidate_profile
        except ObjectDoesNotExist:
            return None
        try:
            preference = profile.job_preference
        except ObjectDoesNotExist:
            preference = None
        return {
            'date_of_birth': _masked(profile.date_of_birth, visible=sensitive),
            'gender': profile.gender,
            'address': _masked(profile.address, visible=sensitive),
            'headline': profile.headline,
            'bio': profile.bio,
            'career_objective': profile.career_objective,
            'current_position': profile.current_position,
            'desired_position': profile.desired_position,
            'experience_years': profile.experience_years,
            'education_level': profile.education_level,
            'expected_salary_min': profile.expected_salary_min,
            'expected_salary_max': profile.expected_salary_max,
            'preferred_location': profile.preferred_location,
            'preferred_work_type': profile.preferred_work_type,
            'job_search_status': profile.job_search_status,
            'portfolio_url': profile.portfolio_url,
            'github_url': profile.github_url,
            'linkedin_url': profile.linkedin_url,
            'job_preferences_configured': profile.job_preferences_configured,
            'job_preference': (
                {
                    'desired_position_other': preference.desired_position_other,
                    'desired_salary_vnd': preference.desired_salary_vnd,
                    'experience_level': preference.experience_level,
                    'willing_to_relocate': preference.willing_to_relocate,
                    'desired_specializations': [
                        {
                            'id': item.job_category_id,
                            'name': item.job_category.name,
                        }
                        for item in preference.desired_specializations.all()
                    ],
                    'preferred_provinces': [
                        {
                            'id': item.location_id,
                            'name': item.location.name,
                        }
                        for item in preference.preferred_provinces.all()
                    ],
                }
                if preference
                else None
            ),
        }

    def _employer(self, user, sensitive):
        try:
            recruiter = user.recruiter_profile
        except ObjectDoesNotExist:
            return None
        company = recruiter.company
        request = self.context.get('request')
        industry_assignments = list(company.company_industries.all()) if company else []
        primary_industry = next(
            (item.industry.name for item in industry_assignments if item.is_primary),
            None,
        )
        return {
            'position_title': recruiter.position_title,
            'gender': recruiter.gender,
            'contact_phone': _masked(recruiter.contact_phone, visible=sensitive),
            'verified_phone': _masked(recruiter.verified_phone, visible=sensitive),
            'phone_verified_at': recruiter.phone_verified_at,
            'work_location': (
                {
                    'id': recruiter.work_location_id,
                    'name': recruiter.work_location.name,
                }
                if recruiter.work_location_id
                else None
            ),
            'company_role': recruiter.company_role,
            'registration_completed_at': recruiter.registration_completed_at,
            'terms_accepted_at': recruiter.terms_accepted_at,
            'terms_policy_version': recruiter.terms_policy_version,
            'marketing_opt_in': recruiter.marketing_opt_in,
            'marketing_decided_at': recruiter.marketing_decided_at,
            'dpa_accepted_at': recruiter.dpa_accepted_at,
            'onboarding_completed_at': recruiter.onboarding_completed_at,
            'company': (
                {
                    'public_id': company.public_id,
                    'slug': company.slug,
                    'business_type': company.business_type,
                    'legal_name': company.company_name,
                    'trade_name': company.trade_name,
                    'trade_name_same_as_registered': company.trade_name_same_as_registered,
                    'tax_code': _masked(company.tax_code, visible=sensitive),
                    'logo_url': media_url_from_value(company.logo_url, request=request),
                    'has_no_logo': company.has_no_logo,
                    'cover_image_url': media_url_from_value(
                        company.cover_image_url,
                        request=request,
                    ),
                    'industries': [
                        {
                            'id': item.industry_id,
                            'name': item.industry.name,
                            'is_primary': item.is_primary,
                        }
                        for item in industry_assignments
                    ],
                    'primary_industry': primary_industry,
                    'company_size': company.company_size,
                    'address': _masked(company.address, visible=sensitive),
                    'website_url': company.website_url,
                    'has_no_website': company.has_no_website,
                    'email': _masked(company.email, visible=sensitive),
                    'phone': _masked(company.phone, visible=sensitive),
                    'description': company.description,
                    'employee_benefits': company.employee_benefits,
                    'markets': company.markets,
                    'target_customers': company.target_customers,
                    'founded_year': company.founded_year,
                    'has_brand_page': company.has_brand_page,
                    'verification_status': company.verification_status,
                    'verified_at': company.verified_at,
                    'rejected_reason': company.rejected_reason,
                    'created_by_public_id': company.created_by.public_id,
                    'created_by_email': company.created_by.email,
                    'created_at': company.created_at,
                    'updated_at': company.updated_at,
                    'images': [
                        {
                            'id': image.id,
                            'image_url': media_url_from_value(
                                image.image_url,
                                request=request,
                            ),
                            'caption': image.caption,
                            'sort_order': image.sort_order,
                            'created_at': image.created_at,
                        }
                        for image in company.images.all()
                    ],
                }
                if company
                else None
            ),
        }

    def _admin(self, user):
        memberships = getattr(user, 'active_admin_memberships', [])
        return {
            'is_superuser': user.is_superuser,
            'memberships': [
                {
                    'public_id': membership.public_id,
                    'role': membership.role.name,
                    'department': membership.role.department.name,
                    'permissions': sorted(
                        permission.code
                        for permission in membership.role.permissions.all()
                        if permission.is_active
                    ),
                }
                for membership in memberships
            ],
        }


class AdminAccountProfileUpdateSerializer(serializers.Serializer):
    full_name = serializers.CharField(max_length=255, required=False)
    phone = serializers.CharField(max_length=20, required=False, allow_blank=True)
    date_of_birth = serializers.DateField(required=False, allow_null=True)
    gender = serializers.CharField(max_length=20, required=False, allow_blank=True)
    address = serializers.CharField(required=False, allow_blank=True)
    headline = serializers.CharField(max_length=255, required=False, allow_blank=True)
    bio = serializers.CharField(required=False, allow_blank=True)
    career_objective = serializers.CharField(required=False, allow_blank=True)
    current_position = serializers.CharField(max_length=255, required=False, allow_blank=True)
    desired_position = serializers.CharField(max_length=255, required=False, allow_blank=True)
    experience_years = serializers.DecimalField(
        max_digits=4,
        decimal_places=1,
        required=False,
    )
    education_level = serializers.CharField(max_length=255, required=False, allow_blank=True)
    expected_salary_min = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        required=False,
        allow_null=True,
    )
    expected_salary_max = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        required=False,
        allow_null=True,
    )
    preferred_location = serializers.CharField(max_length=255, required=False, allow_blank=True)
    preferred_work_type = serializers.CharField(max_length=50, required=False, allow_blank=True)
    job_search_status = serializers.CharField(max_length=50, required=False, allow_blank=True)
    portfolio_url = serializers.URLField(required=False, allow_blank=True)
    github_url = serializers.URLField(required=False, allow_blank=True)
    linkedin_url = serializers.URLField(required=False, allow_blank=True)
    position_title = serializers.CharField(max_length=255, required=False, allow_blank=True)
    contact_phone = serializers.CharField(max_length=20, required=False, allow_blank=True)
    work_location_id = serializers.IntegerField(required=False, allow_null=True)


class AdminCvSerializer(serializers.ModelSerializer):
    source_label = serializers.CharField(source='get_source_display', read_only=True)
    processing_status_label = serializers.CharField(
        source='get_processing_status_display',
        read_only=True,
    )
    lifecycle_status_label = serializers.CharField(
        source='get_lifecycle_status_display',
        read_only=True,
    )
    visibility_label = serializers.CharField(source='get_visibility_display', read_only=True)
    template_name = serializers.CharField(source='template.name', allow_null=True, read_only=True)

    class Meta:
        model = UserCv
        fields = [
            'public_id',
            'title',
            'source',
            'source_label',
            'template_name',
            'processing_status',
            'processing_status_label',
            'lifecycle_status',
            'lifecycle_status_label',
            'visibility',
            'visibility_label',
            'is_default',
            'updated_at',
        ]


class AdminApplicationSerializer(serializers.ModelSerializer):
    status_label = serializers.CharField(source='get_status_display', read_only=True)
    source_label = serializers.CharField(source='get_source_display', read_only=True)
    job_public_id = serializers.CharField(source='job.public_id', read_only=True)
    job_title = serializers.CharField(source='job.title', read_only=True)
    company_name = serializers.CharField(source='job.company.company_name', read_only=True)
    submitted_cv_version_public_id = serializers.CharField(
        source='submitted_cv_version.public_id',
        read_only=True,
    )

    class Meta:
        model = Application
        fields = [
            'public_id',
            'job_public_id',
            'job_title',
            'company_name',
            'submitted_cv_title',
            'submitted_cv_version_public_id',
            'status',
            'status_label',
            'source',
            'source_label',
            'applied_at',
            'viewed_at',
            'shortlisted_at',
            'interviewed_at',
            'rejected_at',
            'accepted_at',
        ]


class AdminCandidateConsentSerializer(serializers.ModelSerializer):
    consent_type_label = serializers.CharField(
        source='get_consent_type_display',
        read_only=True,
    )
    decision_label = serializers.CharField(source='get_decision_display', read_only=True)

    class Meta:
        model = CandidateConsent
        fields = [
            'consent_type',
            'consent_type_label',
            'decision',
            'decision_label',
            'policy_version',
            'decided_at',
            'updated_at',
        ]


class AdminRecruitmentNeedSerializer(serializers.ModelSerializer):
    position_category_name = serializers.CharField(
        source='position_category.name',
        read_only=True,
    )
    position_level_label = serializers.CharField(
        source='get_position_level_display',
        read_only=True,
    )
    budget_source_label = serializers.CharField(
        source='get_budget_source_display',
        read_only=True,
    )

    class Meta:
        model = RecruitmentNeed
        fields = [
            'public_id',
            'position_category_name',
            'position_level',
            'position_level_label',
            'target_date',
            'is_continuous',
            'headcount',
            'budget_min',
            'budget_max',
            'budget_source',
            'budget_source_label',
            'consultation_topics',
            'is_active',
            'completed_at',
            'updated_at',
        ]


class AdminJobSerializer(serializers.ModelSerializer):
    status_label = serializers.CharField(source='get_status_display', read_only=True)
    campaign_name = serializers.CharField(source='campaign.name', allow_null=True, read_only=True)
    company_name = serializers.CharField(source='company.company_name', read_only=True)

    class Meta:
        model = Job
        fields = [
            'public_id',
            'title',
            'company_name',
            'campaign_name',
            'status',
            'status_label',
            'application_count',
            'view_count',
            'deadline',
            'submitted_at',
            'published_at',
            'created_at',
            'updated_at',
        ]


class AdminCampaignSerializer(serializers.ModelSerializer):
    status_label = serializers.CharField(source='get_status_display', read_only=True)
    position_category_name = serializers.CharField(
        source='position_category.name',
        allow_null=True,
        read_only=True,
    )
    job_count = serializers.IntegerField(read_only=True)
    application_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = RecruitmentCampaign
        fields = [
            'public_id',
            'name',
            'description',
            'position_category_name',
            'headcount_target',
            'status',
            'status_label',
            'job_count',
            'application_count',
            'start_date',
            'target_date',
            'created_at',
            'updated_at',
        ]
