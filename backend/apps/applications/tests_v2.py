from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework.test import APITestCase

from apps.cv_templates.models import CvTemplate, CvTemplateVersion
from apps.cvs.models import CvVersion
from apps.cvs.schemas import empty_layout, empty_style
from apps.cvs.services import create_application_snapshot, create_v2_cv, save_draft_as_version, update_draft
from apps.employers.models import Company, RecruiterProfile
from apps.jobs.models import Job

from .models import Application


class RecruiterApplicationSnapshotV2Tests(APITestCase):
    def setUp(self):
        self.candidate = get_user_model().objects.create_user(
            email='snapshot-candidate@example.com', password='password', role='candidate', email_verified=True,
        )
        self.owner = get_user_model().objects.create_user(
            email='snapshot-owner@example.com', password='password', role='employer',
        )
        self.member = get_user_model().objects.create_user(
            email='snapshot-member@example.com', password='password', role='employer',
        )
        self.outsider = get_user_model().objects.create_user(
            email='snapshot-outsider@example.com', password='password', role='employer',
        )
        self.company = Company.objects.create(company_name='Snapshot Company', created_by=self.owner)
        RecruiterProfile.objects.create(
            user=self.member,
            company=self.company,
            company_role=RecruiterProfile.CompanyRole.MEMBER,
            membership_status=RecruiterProfile.MembershipStatus.APPROVED,
        )
        self.job = Job.objects.create(
            posted_by=self.owner,
            company=self.company,
            title='Snapshot Job', description='Read immutable application snapshots.', status=Job.Status.ACTIVE,
        )
        template = CvTemplate.objects.create(
            name='Snapshot template', lifecycle_status=CvTemplate.LifecycleStatus.PUBLISHED,
        )
        template_version = CvTemplateVersion.objects.create(
            template=template,
            version_number=1,
            version_status=CvTemplateVersion.VersionStatus.PUBLISHED,
            renderer_key='classic_single_column_v1',
            renderer_version='1',
            default_layout_json=empty_layout(),
            default_style_json=empty_style(),
        )
        template.current_published_version = template_version
        template.save(update_fields=['current_published_version'])
        self.cv = create_v2_cv(actor=self.candidate, title='Application CV', template=template)
        self.snapshot = create_application_snapshot(self.cv, self.candidate)
        self.application = Application.objects.create(
            candidate=self.candidate,
            job=self.job,
            cv=self.cv,
            submitted_cv_version=self.snapshot,
            submitted_cv_title=self.cv.title,
            submitted_cv_source=self.cv.source,
        )

    def test_approved_company_member_reads_snapshot_not_a_later_mutable_cv_version(self):
        draft = self.cv.draft
        changed_content = draft.content_json
        changed_content['personal_info']['full_name'] = 'Changed after apply'
        update_draft(
            cv=self.cv,
            actor=self.candidate,
            content_json=changed_content,
            layout_json=draft.layout_json,
            style_json=draft.style_json,
            expected_lock_version=draft.lock_version,
        )
        save_draft_as_version(cv=self.cv, actor=self.candidate, expected_lock_version=1)
        self.assertEqual(CvVersion.objects.filter(cv=self.cv).count(), 3)

        self.client.force_authenticate(self.member)
        response = self.client.get(reverse('recruiter-application-snapshot-v2', kwargs={'public_id': self.application.public_id}))

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['cv']['public_id'], self.snapshot.public_id)
        self.assertEqual(response.data['cv']['content_json']['personal_info']['full_name'], '')
        self.assertNotIn('cv_data', response.data['cv'])

    def test_recruiter_outside_the_application_company_receives_404(self):
        self.client.force_authenticate(self.outsider)

        response = self.client.get(reverse('recruiter-application-snapshot-v2', kwargs={'public_id': self.application.public_id}))

        self.assertEqual(response.status_code, 404)
