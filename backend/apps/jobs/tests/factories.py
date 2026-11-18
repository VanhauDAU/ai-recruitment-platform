"""Shared builders for job tests."""

from datetime import timedelta

from django.contrib.auth import get_user_model
from django.utils import timezone

from apps.employers.models import Company
from apps.employers.tests.factories import make_employer_ready
from apps.locations.models import Location
from apps.sitecontent.models import SiteSetting
from common.vietnam_time import vietnam_today

from ..models import (
    Job,
    JobApplicationContact,
    JobApplicationEmail,
    JobCategory,
    JobCategoryAssignment,
    JobLocation,
    JobWorkSchedule,
)


def open_visibility_window(*, days=30):
    """Visibility window of a job that went live yesterday, as publishing sets it."""
    now = timezone.now()
    return {
        'visibility_starts_at': now - timedelta(days=1),
        'visibility_ends_at': now + timedelta(days=days),
    }


def enable_email_notifications():
    """Turn on the site-wide email switch that every candidate digest checks first."""
    SiteSetting.objects.update_or_create(
        key='email_notifications_enabled',
        defaults={
            'label': 'Email notifications',
            'group': SiteSetting.Group.EMAIL,
            'value': True,
            'value_type': SiteSetting.ValueType.BOOLEAN,
        },
    )


class JobPostingFixture:
    """A verified recruiter, an unverified colleague and complete job builders."""

    def setUp(self):
        super().setUp()
        self.user = get_user_model().objects.create_user(
            email='posting-owner@example.com', password='password', role='employer'
        )
        self.other_user = get_user_model().objects.create_user(
            email='posting-other@example.com', password='password', role='employer'
        )
        self.company = Company.objects.create(company_name='Posting Co', created_by=self.user)
        self.recruiter = make_employer_ready(
            self.user,
            company=self.company,
            candidate_data=True,
        )
        # The second recruiter can use the workspace but is not verified yet.
        make_employer_ready(self.other_user, company=self.company)
        self.category = JobCategory.objects.create(
            name='Backend', category_type=JobCategory.CategoryType.SPECIALIZATION
        )
        province = Location.objects.create(
            code='posting-province', level=Location.Level.PROVINCE, name='Hà Nội'
        )
        self.ward = Location.objects.create(
            code='posting-ward',
            level=Location.Level.WARD,
            name='Phường Dịch Vọng',
            parent=province,
        )
        self.free_entitlement = {
            'verification_completed': False,
            'admin_approved': False,
            'account_level': 0,
            'verified_job_quota_eligible': False,
        }

    def make_publishable_job(self, *, title='Backend Engineer', owner=None):
        job = Job.objects.create(
            posted_by=owner or self.user,
            company=self.company,
            title=title,
            description='Xây dựng hệ thống backend có khả năng mở rộng.',
            requirements='Có kinh nghiệm phát triển API và làm việc nhóm.',
            benefits='Lương thưởng cạnh tranh và bảo hiểm đầy đủ.',
            work_type=Job.WorkType.ONSITE,
            employment_type=Job.EmploymentType.FULL_TIME,
            education_level=Job.EducationLevel.UNIVERSITY,
            experience_years=Job.ExperienceYears.TWO,
            position_level=Job.PositionLevel.EMPLOYEE,
            deadline=vietnam_today() + timedelta(days=14),
            number_of_vacancies=1,
        )
        JobCategoryAssignment.objects.create(
            job=job,
            category=self.category,
            role=JobCategoryAssignment.Role.PRIMARY_SPECIALIZATION,
        )
        JobLocation.objects.create(
            job=job,
            location=self.ward,
            address_detail='Tòa nhà ProCV, Cầu Giấy',
        )
        JobWorkSchedule.objects.create(
            job=job,
            weekday_from=1,
            weekday_to=5,
            start_time='08:00:00',
            end_time='17:00:00',
        )
        contact = JobApplicationContact.objects.create(
            job=job,
            recipient_name='Trưởng phòng nhân sự',
            phone='0900000000',
        )
        JobApplicationEmail.objects.create(contact=contact, email='hr@example.com')
        return job

    def make_active_job(self, *, deadline=None, published_at=None, campaign=None):
        published_at = published_at or timezone.now()
        job = self.make_publishable_job()
        job.campaign = campaign
        job.status = Job.Status.ACTIVE
        job.deadline = deadline or vietnam_today() + timedelta(days=14)
        job.submitted_at = published_at
        job.published_at = published_at
        job.approved_at = published_at
        # Public-cycle anchor of a job that asked for the longest window.
        job.requested_visibility_days = 90
        job.first_approved_at = job.visibility_starts_at = published_at
        job.visibility_ends_at = published_at + timedelta(days=90)
        job.save(
            update_fields=[
                'campaign',
                'status',
                'deadline',
                'submitted_at',
                'published_at',
                'approved_at',
                'requested_visibility_days',
                'first_approved_at',
                'visibility_starts_at',
                'visibility_ends_at',
            ]
        )
        return job
