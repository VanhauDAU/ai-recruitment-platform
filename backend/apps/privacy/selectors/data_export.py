"""Gói dữ liệu cá nhân trả cho chủ thể dữ liệu khi yêu cầu xuất được duyệt."""

from django.utils import timezone

from apps.applications.models import Application
from apps.candidates.models import CandidateProfile
from apps.cvs.models import UserCv
from apps.employers.models import CompanyFollow, RecruiterProfile
from apps.jobs.models import Job, SavedJob
from apps.messaging.selectors import personal_messages

EXPORT_FORMAT_VERSION = 1

_CANDIDATE_PROFILE_FIELDS = (
    'date_of_birth',
    'gender',
    'address',
    'headline',
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
    'bio',
    'career_objective',
)
_RECRUITER_PROFILE_FIELDS = (
    'position_title',
    'gender',
    'contact_phone',
    'verified_phone',
    'terms_accepted_at',
    'terms_policy_version',
    'marketing_opt_in',
    'dpa_accepted_at',
    'dpa_policy_version',
)


def _fields(instance, names):
    return {name: getattr(instance, name) for name in names} if instance else None


def _candidate_section(user):
    profile = CandidateProfile.objects.filter(user=user).first()
    cvs = UserCv.objects.filter(user=user, is_deleted=False).select_related('latest_version')
    applications = Application.objects.filter(candidate=user).select_related('job__company')
    return {
        'profile': _fields(profile, _CANDIDATE_PROFILE_FIELDS),
        'cvs': [
            {
                'public_id': cv.public_id,
                'title': cv.title,
                'source': cv.source,
                'file_name': cv.file_name,
                'created_at': cv.created_at,
                'updated_at': cv.updated_at,
                'content': cv.latest_version.content_json if cv.latest_version else None,
            }
            for cv in cvs
        ],
        'applications': [
            {
                'public_id': application.public_id,
                'job_title': application.job.title,
                'company_name': application.job.company.company_name,
                'status': application.status,
                'applied_at': application.applied_at,
                'cv_title': application.submitted_cv_title,
                'cover_letter': application.cover_letter,
                'contact_name': application.contact_name,
                'contact_email': application.contact_email,
                'contact_phone': application.contact_phone,
            }
            for application in applications
        ],
        'saved_jobs': [
            {'job_title': saved.job.title, 'saved_at': saved.created_at}
            for saved in SavedJob.objects.filter(candidate=user).select_related('job')
        ],
        'followed_companies': [
            {'company_name': follow.company.company_name, 'followed_at': follow.created_at}
            for follow in CompanyFollow.objects.filter(candidate=user).select_related('company')
        ],
    }


def _employer_section(user):
    profile = RecruiterProfile.objects.filter(user=user).select_related('company').first()
    return {
        'profile': _fields(profile, _RECRUITER_PROFILE_FIELDS),
        'company_name': profile.company.company_name if profile and profile.company else None,
        'company_role': profile.company_role if profile else None,
        'jobs_posted': [
            {'title': job.title, 'status': job.status, 'created_at': job.created_at}
            for job in Job.objects.filter(posted_by=user).only('title', 'status', 'created_at')
        ],
    }


def build_personal_data_export(user):
    """Dữ liệu cá nhân của một tài khoản, dạng dict sẵn sàng tuần tự hóa JSON."""
    section = _candidate_section(user) if user.is_candidate else _employer_section(user)
    section['connect_messages'] = personal_messages(user)
    return {
        'format_version': EXPORT_FORMAT_VERSION,
        'generated_at': timezone.now(),
        'account': {
            'account_code': user.public_id,
            'role': user.role,
            'email': user.email,
            'full_name': user.full_name,
            'phone': user.phone,
            'preferred_language': user.preferred_language,
            'email_verified': user.email_verified,
            'date_joined': user.date_joined,
            'last_login': user.last_login,
        },
        user.role: section,
    }
