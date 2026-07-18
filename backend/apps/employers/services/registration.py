"""Employer account registration and first-profile completion."""

from django.conf import settings
from django.db import transaction
from django.utils import timezone
from django.utils.text import slugify
from rest_framework.exceptions import ValidationError

from apps.accounts.models import User

from ..models import Company, RecruiterProfile
from .profiles import get_or_create_recruiter


def _company_slug(company_name, user):
    base = slugify(company_name) or 'doanh-nghiep'
    return f'{base}-{user.public_id[-8:].lower()}'


@transaction.atomic
def complete_registration_profile(user, validated_data):
    if not user.is_employer:
        raise ValidationError({'detail': 'Chỉ tài khoản nhà tuyển dụng được cập nhật hồ sơ này.'})

    recruiter = get_or_create_recruiter(user)
    if recruiter.registration_completed_at is not None:
        raise ValidationError({'detail': 'Thông tin đăng ký nhà tuyển dụng đã được hoàn tất.'})

    now = timezone.now()
    location = validated_data['work_location']
    contact_phone = validated_data['contact_phone']

    user.full_name = validated_data['full_name']
    user.phone = contact_phone
    user.save(update_fields=['full_name', 'phone', 'updated_at'])

    if recruiter.company_id is None:
        company = Company.objects.create(
            company_name=validated_data['company_name'],
            slug=_company_slug(validated_data['company_name'], user),
            email=user.email,
            phone=contact_phone,
            address=location.name,
            has_no_logo=True,
            has_no_website=True,
            created_by=user,
        )
        recruiter.company = company
        recruiter.company_role = RecruiterProfile.CompanyRole.OWNER
        recruiter.membership_status = RecruiterProfile.MembershipStatus.APPROVED

    recruiter.gender = validated_data['gender']
    recruiter.contact_phone = contact_phone
    recruiter.work_location = location
    recruiter.registration_completed_at = now
    recruiter.terms_accepted_at = now
    recruiter.terms_policy_version = settings.EMPLOYER_TERMS_POLICY_VERSION
    recruiter.marketing_opt_in = validated_data.get('marketing_opt_in', False)
    recruiter.marketing_decided_at = now
    recruiter.save()
    return recruiter


@transaction.atomic
def register_employer(validated_data):
    account_data = dict(validated_data)
    email = account_data.pop('email')
    password = account_data.pop('password')
    account_data.pop('captcha_token', None)
    account_data.pop('terms_accepted', None)

    user = User.objects.create_user(
        email=email,
        password=password,
        role=User.Role.EMPLOYER,
    )
    account_data['terms_accepted'] = True
    recruiter = complete_registration_profile(user, account_data)
    return user, recruiter
