"""Administrator edits of the profile fields an account owner normally manages."""

from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils.translation import gettext as _

from apps.candidates.models import CandidateProfile
from apps.employers.models import RecruiterProfile
from apps.locations.models import Location

from ..models import (
    User,
)
from .admin_account_common import (
    admin_actor_kwargs,
    ensure_account_write_allowed,
)
from .admin_audit import record_admin_action


def update_account_profile(user, *, full_name, phone, actor):
    ensure_account_write_allowed(actor, user)
    with transaction.atomic():
        user = User.objects.select_for_update().get(pk=user.pk)
        changed = []
        for field, value in (('full_name', full_name.strip()), ('phone', phone.strip())):
            if getattr(user, field) != value:
                setattr(user, field, value)
                changed.append(field)
        if changed:
            user.save(update_fields=[*changed, 'updated_at'])
            record_admin_action(
                **admin_actor_kwargs(actor),
                action='update_account_profile',
                target_type='user',
                target_public_id=user.public_id,
                payload={'user_public_id': user.public_id, 'changed_fields': changed},
            )
        return user


def update_managed_account_profile(user, *, actor, changes):
    """Update only administrator-safe profile fields for the target role."""
    ensure_account_write_allowed(actor, user)
    account_fields = {'full_name', 'phone'}
    candidate_fields = {
        'date_of_birth',
        'gender',
        'address',
        'headline',
        'bio',
        'career_objective',
        'current_position',
        'desired_position',
        'experience_years',
        'education_level',
        'expected_salary_min',
        'expected_salary_max',
        'preferred_location',
        'preferred_work_type',
        'job_search_status',
        'portfolio_url',
        'github_url',
        'linkedin_url',
    }
    employer_fields = {'gender', 'position_title', 'contact_phone'}

    with transaction.atomic():
        user = User.objects.select_for_update().get(pk=user.pk)
        changed_fields = []
        user_updates = []
        for field in account_fields & changes.keys():
            value = changes[field].strip() if isinstance(changes[field], str) else changes[field]
            if getattr(user, field) != value:
                setattr(user, field, value)
                user_updates.append(field)
                changed_fields.append(f'account.{field}')
        if user_updates:
            user.save(update_fields=[*user_updates, 'updated_at'])

        if user.is_candidate:
            profile, _created = CandidateProfile.objects.select_for_update().get_or_create(
                user=user
            )
            profile_updates = []
            for field in candidate_fields & changes.keys():
                value = changes[field]
                if isinstance(value, str):
                    value = value.strip()
                if getattr(profile, field) != value:
                    setattr(profile, field, value)
                    profile_updates.append(field)
                    changed_fields.append(f'candidate.{field}')
            if profile_updates:
                profile.save(update_fields=[*profile_updates, 'updated_at'])
        elif user.is_employer:
            recruiter, _created = RecruiterProfile.objects.select_for_update().get_or_create(
                user=user
            )
            recruiter_updates = []
            for field in employer_fields & changes.keys():
                value = changes[field].strip()
                if getattr(recruiter, field) != value:
                    setattr(recruiter, field, value)
                    recruiter_updates.append(field)
                    changed_fields.append(f'employer.{field}')
            if 'work_location_id' in changes:
                location_id = changes['work_location_id']
                if location_id is not None and not Location.objects.filter(pk=location_id).exists():
                    raise ValidationError(
                        {'work_location_id': _('Địa điểm làm việc không tồn tại.')}
                    )
                if recruiter.work_location_id != location_id:
                    recruiter.work_location_id = location_id
                    recruiter_updates.append('work_location')
                    changed_fields.append('employer.work_location')
            if recruiter_updates:
                recruiter.save(update_fields=[*recruiter_updates, 'updated_at'])

        if changed_fields:
            record_admin_action(
                **admin_actor_kwargs(actor),
                action='update_account_profile',
                target_type='user',
                target_public_id=user.public_id,
                payload={
                    'user_public_id': user.public_id,
                    'changed_fields': sorted(changed_fields),
                },
            )
        return user
