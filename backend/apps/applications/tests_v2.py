from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework.test import APITestCase

from apps.accounts.services.tokens import issue_tokens
from apps.cv_templates.models import CvTemplate, CvTemplateVersion
from apps.cvs.models import CvVersion
from apps.cvs.schemas import empty_layout, empty_style
from apps.cvs.services import (
    create_application_snapshot,
    create_v2_cv,
    save_draft_as_version,
    update_draft,
)
from apps.employers.models import Company, RecruiterProfile
from apps.jobs.models import Job, JobLocation
from apps.locations.models import Location

from .models import Application


class RecruiterApplicationSnapshotV2Tests(APITestCase):
    def setUp(self):
        self.candidate = get_user_model().objects.create_user(
            email='snapshot-candidate@example.com',
            password='password',
            role='candidate',
            email_verified=True,
        )
        self.owner = get_user_model().objects.create_user(
            email='snapshot-owner@example.com',
            password='password',
            role='employer',
            two_factor_enabled=True,
        )
        self.member = get_user_model().objects.create_user(
            email='snapshot-member@example.com',
            password='password',
            role='employer',
            two_factor_enabled=True,
        )
        self.outsider = get_user_model().objects.create_user(
            email='snapshot-outsider@example.com',
            password='password',
            role='employer',
            two_factor_enabled=True,
        )
        self.company = Company.objects.create(
            company_name='Snapshot Company', created_by=self.owner
        )
        RecruiterProfile.objects.create(
            user=self.member,
            company=self.company,
            company_role=RecruiterProfile.CompanyRole.MEMBER,
        )
        self.job = Job.objects.create(
            posted_by=self.owner,
            company=self.company,
            title='Snapshot Job',
            description='Read immutable application snapshots.',
            status=Job.Status.ACTIVE,
        )
        template = CvTemplate.objects.create(
            name='Snapshot template',
            lifecycle_status=CvTemplate.LifecycleStatus.PUBLISHED,
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

        tokens = issue_tokens(self.member, auth_method='mfa')
        self.client.credentials(HTTP_AUTHORIZATION='Bearer ' + tokens['access'])
        response = self.client.get(
            reverse(
                'recruiter-application-snapshot-v2',
                kwargs={'public_id': self.application.public_id},
            )
        )

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['cv']['public_id'], self.snapshot.public_id)
        self.assertEqual(response.data['cv']['content_json']['personal_info']['full_name'], '')
        self.assertNotIn('cv_data', response.data['cv'])

    def test_recruiter_outside_the_application_company_receives_404(self):
        tokens = issue_tokens(self.outsider, auth_method='mfa')
        self.client.credentials(HTTP_AUTHORIZATION='Bearer ' + tokens['access'])

        response = self.client.get(
            reverse(
                'recruiter-application-snapshot-v2',
                kwargs={'public_id': self.application.public_id},
            )
        )

        self.assertEqual(response.status_code, 404)

    def test_candidate_delete_removes_library_cv_but_retains_submitted_snapshot(self):
        self.client.force_authenticate(self.candidate)

        response = self.client.delete(
            reverse('cv-v2-detail', kwargs={'public_id': self.cv.public_id})
        )

        self.assertEqual(response.status_code, 204, response.data)
        self.assertFalse(type(self.cv).objects.filter(pk=self.cv.pk).exists())
        self.application.refresh_from_db()
        self.snapshot.refresh_from_db()
        self.assertIsNone(self.application.cv_id)
        self.assertIsNone(self.snapshot.cv_id)

        self.client.force_authenticate(user=None)
        tokens = issue_tokens(self.member, auth_method='mfa')
        self.client.credentials(HTTP_AUTHORIZATION='Bearer ' + tokens['access'])
        snapshot_response = self.client.get(
            reverse(
                'recruiter-application-snapshot-v2',
                kwargs={'public_id': self.application.public_id},
            ),
        )
        self.assertEqual(snapshot_response.status_code, 200, snapshot_response.data)
        self.assertEqual(snapshot_response.data['cv']['public_id'], self.snapshot.public_id)


class CandidateApplicationV2Tests(APITestCase):
    def setUp(self):
        self.candidate = get_user_model().objects.create_user(
            email='apply-candidate@example.com',
            password='password',
            role='candidate',
            email_verified=True,
            full_name='Apply Candidate',
            phone='0909000000',
        )
        self.other_candidate = get_user_model().objects.create_user(
            email='other-apply-candidate@example.com',
            password='password',
            role='candidate',
            email_verified=True,
        )
        self.employer = get_user_model().objects.create_user(
            email='apply-employer@example.com',
            password='password',
            role='employer',
        )
        self.company = Company.objects.create(
            company_name='Apply Company', created_by=self.employer
        )
        self.job = Job.objects.create(
            posted_by=self.employer,
            company=self.company,
            title='Apply Job',
            description='Candidate selects an immutable CV version.',
            status=Job.Status.ACTIVE,
        )
        self.preferred_location = Location.objects.create(
            code='74',
            level=Location.Level.PROVINCE,
            name='Bình Dương',
        )
        self.second_preferred_location = Location.objects.create(
            code='48',
            level=Location.Level.PROVINCE,
            name='Đà Nẵng',
        )
        JobLocation.objects.create(job=self.job, location=self.preferred_location)
        JobLocation.objects.create(job=self.job, location=self.second_preferred_location)
        template = CvTemplate.objects.create(
            name='Apply template',
            lifecycle_status=CvTemplate.LifecycleStatus.PUBLISHED,
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
        self.cv = create_v2_cv(actor=self.candidate, title='Selected CV', template=template)
        self.other_cv = create_v2_cv(
            actor=self.other_candidate, title='Other CV', template=template
        )

    def apply_payload(self, **overrides):
        payload = {
            'job_public_id': self.job.public_id,
            'cv_public_id': self.cv.public_id,
            'version_public_id': self.cv.latest_version.public_id,
            'cover_letter': 'I would like to apply.',
            'preferred_location_ids': [
                self.preferred_location.id,
                self.second_preferred_location.id,
            ],
            'allow_ai_analysis': False,
            'data_processing_consent': True,
        }
        payload.update(overrides)
        return payload

    def test_candidate_submits_explicit_version_without_mutating_cv_pointers(self):
        selected_version = self.cv.latest_version
        self.client.force_authenticate(self.candidate)

        response = self.client.post(
            reverse('candidate-application-list-create-v2'),
            self.apply_payload(version_public_id=selected_version.public_id),
            format='json',
        )

        self.assertEqual(response.status_code, 201, response.data)
        application = Application.objects.get(public_id=response.data['public_id'])
        self.cv.refresh_from_db()
        self.assertEqual(application.submitted_cv_version.parent_version_id, selected_version.id)
        self.assertEqual(
            application.submitted_cv_version.version_kind,
            CvVersion.VersionKind.APPLICATION_SNAPSHOT,
        )
        self.assertEqual(
            application.submitted_cv_version.public_id,
            response.data['submitted_cv_version_public_id'],
        )
        self.assertEqual(self.cv.latest_version_id, selected_version.id)
        self.assertEqual(response.data['cv_public_id'], self.cv.public_id)
        self.assertEqual(
            response.data['preferred_location_ids'],
            [self.preferred_location.id, self.second_preferred_location.id],
        )
        self.assertEqual(response.data['preferred_location_names'], ['Bình Dương', 'Đà Nẵng'])
        self.assertTrue(response.data['data_processing_consent'])
        self.assertEqual(response.data['contact_name'], 'Apply Candidate')
        self.assertEqual(response.data['contact_email'], 'apply-candidate@example.com')
        self.assertEqual(response.data['contact_phone'], '0909000000')

    def test_candidate_cannot_submit_another_candidates_cv_or_submit_twice(self):
        self.client.force_authenticate(self.candidate)
        forbidden_cv = self.client.post(
            reverse('candidate-application-list-create-v2'),
            self.apply_payload(
                cv_public_id=self.other_cv.public_id,
                version_public_id=self.other_cv.latest_version.public_id,
            ),
            format='json',
        )
        first = self.client.post(
            reverse('candidate-application-list-create-v2'),
            self.apply_payload(),
            format='json',
        )
        duplicate = self.client.post(
            reverse('candidate-application-list-create-v2'),
            self.apply_payload(),
            format='json',
        )

        self.assertEqual(forbidden_cv.status_code, 400, forbidden_cv.data)
        self.assertEqual(first.status_code, 201, first.data)
        self.assertEqual(duplicate.status_code, 400, duplicate.data)

    def test_candidate_must_consent_and_select_a_workplace_offered_by_the_job(self):
        other_location = Location.objects.create(
            code='01',
            level=Location.Level.PROVINCE,
            name='Hà Nội',
        )
        self.client.force_authenticate(self.candidate)

        missing_consent = self.client.post(
            reverse('candidate-application-list-create-v2'),
            self.apply_payload(data_processing_consent=False),
            format='json',
        )
        invalid_location = self.client.post(
            reverse('candidate-application-list-create-v2'),
            self.apply_payload(preferred_location_ids=[other_location.id]),
            format='json',
        )

        self.assertEqual(missing_consent.status_code, 400, missing_consent.data)
        self.assertIn('data_processing_consent', missing_consent.data)
        self.assertEqual(invalid_location.status_code, 400, invalid_location.data)
        self.assertIn('preferred_location_ids', invalid_location.data)

    def test_employer_cannot_use_candidate_submission_endpoint(self):
        self.client.force_authenticate(self.employer)

        response = self.client.post(
            reverse('candidate-application-list-create-v2'),
            self.apply_payload(),
            format='json',
        )

        self.assertEqual(response.status_code, 403)
