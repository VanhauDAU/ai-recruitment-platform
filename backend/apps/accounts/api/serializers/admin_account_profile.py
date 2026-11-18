"""Role-aware admin view/edit of an account profile, with sensitive values masked."""

from django.core.exceptions import ObjectDoesNotExist
from rest_framework import serializers

from apps.employers.selectors import build_employer_initial_onboarding
from common.storage.media import media_url_from_value

from .auth import admin_access_payload


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
        initial_onboarding = build_employer_initial_onboarding(recruiter)
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
            'initial_onboarding': initial_onboarding,
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
        return admin_access_payload(user)


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
