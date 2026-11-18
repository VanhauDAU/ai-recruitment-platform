"""Shared scaffolding for the candidate CV API tests: a published template and URL helpers."""

import shutil
import tempfile

from django.contrib.auth import get_user_model
from django.test import override_settings
from django.urls import reverse
from rest_framework.test import APITestCase

from apps.cv_templates.models import (
    CvColor,
    CvPositionProfile,
    CvTemplate,
    CvTemplateColorLink,
    CvTemplateVersion,
    empty_layout,
    empty_style,
)
from apps.cvs.models import UserCv
from apps.jobs.models import JobCategory

TEST_EXPORT_MEDIA_ROOT = tempfile.mkdtemp()


@override_settings(MEDIA_ROOT=TEST_EXPORT_MEDIA_ROOT, ALLOWED_HOSTS=['testserver'])
class CvApiTestCase(APITestCase):
    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        shutil.rmtree(TEST_EXPORT_MEDIA_ROOT, ignore_errors=True)

    def setUp(self):
        self.candidate = get_user_model().objects.create_user(
            email='v2-candidate@example.com',
            password='password',
            role='candidate',
            email_verified=True,
        )
        self.other_candidate = get_user_model().objects.create_user(
            email='v2-other@example.com',
            password='password',
            role='candidate',
            email_verified=True,
        )
        self.template = CvTemplate.objects.create(
            name='V2 Template',
            lifecycle_status=CvTemplate.LifecycleStatus.PUBLISHED,
        )
        self.template_version = CvTemplateVersion.objects.create(
            template=self.template,
            version_number=1,
            version_status=CvTemplateVersion.VersionStatus.PUBLISHED,
            renderer_key='single_column_v1',
            renderer_version='1',
            default_layout_json=empty_layout(),
            default_style_json=empty_style(),
            content_contract={'schema': 'canonical_cv_content_v1', 'schema_version': 1},
        )
        self.template.current_published_version = self.template_version
        self.template.save(update_fields=['current_published_version'])
        self.blue = CvColor.objects.create(name='Blue', slug='blue', hex_code='#2255AA')
        CvTemplateColorLink.objects.create(template=self.template, color=self.blue, is_default=True)
        self.client.force_authenticate(self.candidate)

    def curated_sample_profile(self):
        position = JobCategory.objects.create(name='Sample position')
        return CvPositionProfile.objects.create(job_category=position)

    def create_cv(self):
        response = self.client.post(
            reverse('cv-list-create'),
            {'title': 'CV V2', 'template_public_id': self.template.public_id, 'language': 'vi-VN'},
            format='json',
        )
        self.assertEqual(response.status_code, 201, response.data)
        return UserCv.objects.get(public_id=response.data['public_id'])

    def import_uploaded_cv(self, upload):
        response = self.client.post(reverse('cv-import'), {'file': upload}, format='multipart')
        self.assertEqual(response.status_code, 201, response.data)
        return UserCv.objects.get(public_id=response.data['public_id'])

    def draft_url(self, cv):
        return reverse('cv-draft', kwargs={'public_id': cv.public_id})

    def owner_view_url(self, cv):
        return reverse('cv-owner-view', kwargs={'public_id': cv.public_id})

    def shared_links_url(self, cv):
        return reverse('cv-shared-link-list-create', kwargs={'public_id': cv.public_id})

    def exports_url(self, cv):
        return reverse('cv-export-list-create', kwargs={'public_id': cv.public_id})

    def export_url(self, cv, export, action=None):
        name = {
            None: 'cv-export-detail',
            'retry': 'cv-export-retry',
            'download': 'cv-export-download',
        }[action]
        return reverse(
            name, kwargs={'public_id': cv.public_id, 'export_public_id': export.public_id}
        )

    def create_alternate_template(self):
        template = CvTemplate.objects.create(
            name='Two column V2 Template',
            lifecycle_status=CvTemplate.LifecycleStatus.PUBLISHED,
        )
        layout = empty_layout()
        layout['regions'] = [
            {'id': 'main', 'width_percent': 68, 'section_instance_ids': []},
            {'id': 'sidebar', 'width_percent': 32, 'section_instance_ids': []},
        ]
        style = {**empty_style(), 'theme_color': '#2255AA', 'font_family': 'Inter'}
        version = CvTemplateVersion.objects.create(
            template=template,
            version_number=1,
            version_status=CvTemplateVersion.VersionStatus.PUBLISHED,
            renderer_key='sidebar_right_v1',
            renderer_version='1',
            default_layout_json=layout,
            default_style_json=style,
            capabilities={
                'layout': {
                    'section_drag': True,
                    'cross_region_drag': True,
                    'item_drag': True,
                    'column_resize': {'enabled': True, 'min_percent': 25, 'max_percent': 75},
                },
            },
        )
        template.current_published_version = version
        template.save(update_fields=['current_published_version'])
        return template, version
