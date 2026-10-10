from datetime import timedelta
from io import BytesIO
from unittest.mock import patch

from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from django.utils import timezone
from PIL import Image
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import AdminPermission, AdminRole, Department, User
from apps.accounts.services import assign_membership
from apps.knowledgebase.models import KnowledgeArticle, KnowledgeArticleRevision, KnowledgeCategory


class KnowledgeAdminApiTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.admin = User.objects.create_superuser(
            email='kb-admin@example.com', password='Password@123'
        )
        cls.viewer = User.objects.create_user(
            email='kb-viewer@example.com', password='Password@123', role=User.Role.ADMIN
        )
        department = Department.objects.create(code='kb-api-tests', name='KB API tests')
        role = AdminRole.objects.create(department=department, code='viewer', name='Viewer')
        role.permissions.add(AdminPermission.objects.get(code='knowledgebase.view'))
        assign_membership(cls.viewer, role, actor=cls.admin)
        cls.category = KnowledgeCategory.objects.get(slug='tai-khoan-va-dang-nhap')

    def _create_article(self):
        self.client.force_authenticate(self.admin)
        response = self.client.post(
            reverse('kb-admin-article-list'),
            {
                'category_public_id': self.category.public_id,
                'type': 'FAQ',
                'title': 'Làm thế nào để đăng nhập?',
                'body': '<h2>Các bước</h2><p>Mở trang đăng nhập.</p>',
                'source_reference': '/login',
            },
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        return response

    def test_admin_can_run_draft_review_publish_archive_restore_workflow(self):
        created = self._create_article()
        public_id = created.data['public_id']
        token = created.data['revision_token']
        self.assertIn('private', created['Cache-Control'])

        submitted = self.client.post(
            reverse('kb-admin-revision-submit', args=[public_id, 1]),
            {'revision_token': token},
            format='json',
        )
        self.assertEqual(submitted.status_code, 200, submitted.data)
        approved = self.client.post(
            reverse('kb-admin-revision-approve', args=[public_id, 1]),
            {'revision_token': submitted.data['revision_token']},
            format='json',
        )
        self.assertEqual(approved.status_code, 200, approved.data)
        published = self.client.post(
            reverse('kb-admin-article-publish', args=[public_id]),
            {
                'revision_number': 1,
                'revision_token': approved.data['revision_token'],
            },
            format='json',
        )
        self.assertEqual(published.status_code, 200, published.data)
        self.assertEqual(published.data['published_revision_number'], 1)

        archived = self.client.post(
            reverse('kb-admin-article-archive', args=[public_id]),
            {'revision_token': published.data['revision_token']},
            format='json',
        )
        self.assertEqual(archived.status_code, 200, archived.data)
        self.assertEqual(archived.data['lifecycle_state'], 'ARCHIVED')
        restored = self.client.post(
            reverse('kb-admin-article-restore', args=[public_id]),
            {'revision_token': archived.data['revision_token']},
            format='json',
        )
        self.assertEqual(restored.data['lifecycle_state'], 'ACTIVE')
        self.assertEqual(restored.data['published_revision_number'], 1)
        self.assertTrue(restored.data['audit_events'])

    def test_stale_token_returns_409_and_keeps_editor_content(self):
        created = self._create_article()
        response = self.client.patch(
            reverse('kb-admin-revision-detail', args=[created.data['public_id'], 1]),
            {
                'revision_token': 999,
                'body': '<p>Bản người dùng đang giữ.</p>',
            },
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT, response.data)
        self.assertEqual(response.data['code'], 'knowledgebase_revision_stale')
        self.assertEqual(
            KnowledgeArticleRevision.objects.get(
                article__public_id=created.data['public_id'],
                number=1,
            ).body,
            '<h2>Các bước</h2><p>Mở trang đăng nhập.</p>',
        )

    def test_reject_requires_review_note(self):
        created = self._create_article()
        submitted = self.client.post(
            reverse('kb-admin-revision-submit', args=[created.data['public_id'], 1]),
            {'revision_token': created.data['revision_token']},
            format='json',
        )
        response = self.client.post(
            reverse('kb-admin-revision-reject', args=[created.data['public_id'], 1]),
            {'revision_token': submitted.data['revision_token']},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST, response.data)
        self.assertIn('review_note', response.data)

    def test_view_permission_cannot_mutate_and_candidate_cannot_read(self):
        self.client.force_authenticate(self.viewer)
        self.assertEqual(self.client.get(reverse('kb-admin-article-list')).status_code, 200)
        denied = self.client.post(
            reverse('kb-admin-article-list'),
            {
                'category_public_id': self.category.public_id,
                'type': 'FAQ',
                'title': 'Không được tạo',
                'body': '<p>Nội dung</p>',
                'source_reference': '/test',
            },
            format='json',
        )
        self.assertEqual(denied.status_code, status.HTTP_403_FORBIDDEN)

        candidate = User.objects.create_user(
            email='kb-candidate@example.com', password='Password@123', role=User.Role.CANDIDATE
        )
        self.client.force_authenticate(candidate)
        self.assertEqual(
            self.client.get(reverse('kb-admin-article-list')).status_code,
            status.HTTP_403_FORBIDDEN,
        )

    def test_filters_and_ordering_are_strict(self):
        self._create_article()
        response = self.client.get(
            reverse('kb-admin-article-list'),
            {'category': self.category.slug, 'revision_status': 'DRAFT', 'ordering': '-title'},
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['count'], 1)
        invalid = self.client.get(reverse('kb-admin-article-list'), {'ordering': 'drop table'})
        self.assertEqual(invalid.status_code, status.HTTP_400_BAD_REQUEST)

    def test_category_and_status_ordering_are_applied_by_the_server(self):
        self.client.force_authenticate(self.admin)
        category_a = KnowledgeCategory.objects.create(
            name='AAA chuyên mục sắp xếp',
            slug='aaa-chuyen-muc-sap-xep',
            order=900,
        )
        category_z = KnowledgeCategory.objects.create(
            name='ZZZ chuyên mục sắp xếp',
            slug='zzz-chuyen-muc-sap-xep',
            order=901,
        )
        records = [
            (category_z, 'ACTIVE', KnowledgeArticleRevision.Status.IN_REVIEW, 'Z'),
            (category_a, 'ARCHIVED', KnowledgeArticleRevision.Status.DRAFT, 'A'),
        ]
        for category, lifecycle, revision_status, suffix in records:
            article = KnowledgeArticle.objects.create(
                category=category,
                slug=f'kb-sort-{suffix.lower()}',
                lifecycle_state=lifecycle,
                created_by=self.admin,
            )
            KnowledgeArticleRevision.objects.create(
                article=article,
                number=1,
                status=revision_status,
                title=f'KB sorting contract {suffix}',
                body='<p>Nội dung</p>',
                body_plain_text='Nội dung',
                content_hash=suffix * 64,
                source_reference='/test',
                created_by=self.admin,
            )

        category_sorted = self.client.get(
            reverse('kb-admin-article-list'),
            {'q': 'KB sorting contract', 'ordering': 'category'},
        )
        self.assertEqual(category_sorted.status_code, 200, category_sorted.data)
        self.assertEqual(
            [row['category']['name'] for row in category_sorted.data['results']],
            ['AAA chuyên mục sắp xếp', 'ZZZ chuyên mục sắp xếp'],
        )

        status_sorted = self.client.get(
            reverse('kb-admin-article-list'),
            {'q': 'KB sorting contract', 'ordering': '-revision_status'},
        )
        self.assertEqual(status_sorted.status_code, 200, status_sorted.data)
        self.assertEqual(
            [row['latest_revision']['status'] for row in status_sorted.data['results']],
            ['IN_REVIEW', 'DRAFT'],
        )

    def test_summary_aggregates_the_complete_filtered_result_not_one_page(self):
        self.client.force_authenticate(self.admin)
        for index in range(25):
            article = KnowledgeArticle.objects.create(
                category=self.category,
                slug=f'kb-summary-{index}',
                created_by=self.admin,
                review_due_at=(timezone.now() - timedelta(days=1)) if index < 3 else None,
            )
            revision_status = (
                KnowledgeArticleRevision.Status.APPROVED
                if index < 21
                else KnowledgeArticleRevision.Status.IN_REVIEW
                if index < 23
                else KnowledgeArticleRevision.Status.DRAFT
            )
            revision = KnowledgeArticleRevision.objects.create(
                article=article,
                number=1,
                status=revision_status,
                title=f'KB summary aggregate {index}',
                body='<p>Nội dung</p>',
                body_plain_text='Nội dung',
                content_hash=f'{index:064d}',
                source_reference='/test',
                created_by=self.admin,
            )
            if index < 21:
                article.published_revision = revision
                article.save(update_fields=['published_revision'])

        list_response = self.client.get(
            reverse('kb-admin-article-list'),
            {'q': 'KB summary aggregate'},
        )
        self.assertEqual(len(list_response.data['results']), 20)

        summary = self.client.get(
            reverse('kb-admin-article-summary'),
            {'q': 'KB summary aggregate', 'page': 2, 'page_size': 10},
        )
        self.assertEqual(summary.status_code, 200, summary.data)
        self.assertEqual(
            summary.data,
            {'total': 25, 'published': 21, 'in_review': 2, 'overdue': 3},
        )

    @patch('apps.knowledgebase.api.views.admin.record_metric')
    def test_admin_requests_emit_pii_free_status_and_latency_metrics(self, metric):
        self.client.force_authenticate(self.admin)

        response = self.client.get(reverse('kb-admin-article-list'))

        self.assertEqual(response.status_code, 200)
        names = [call.args[0] for call in metric.call_args_list]
        self.assertEqual(
            names,
            ['knowledgebase_admin_request', 'knowledgebase_admin_latency_ms'],
        )
        self.assertNotIn(self.admin.email, str(metric.call_args_list))

    def test_media_upload_records_verified_dimensions_and_rejects_gif(self):
        self.client.force_authenticate(self.admin)
        image_bytes = BytesIO()
        Image.new('RGB', (48, 32), 'green').save(image_bytes, format='WEBP')
        uploaded = self.client.post(
            reverse('kb-admin-media-list'),
            {
                'file': SimpleUploadedFile(
                    'huong-dan.webp', image_bytes.getvalue(), content_type='image/webp'
                ),
                'default_alt_text': 'Màn hình hướng dẫn',
            },
            format='multipart',
        )
        self.assertEqual(uploaded.status_code, status.HTTP_201_CREATED, uploaded.data)
        self.assertEqual((uploaded.data['width'], uploaded.data['height']), (48, 32))

        gif_bytes = BytesIO()
        Image.new('RGB', (10, 10), 'red').save(gif_bytes, format='GIF')
        rejected = self.client.post(
            reverse('kb-admin-media-list'),
            {'file': SimpleUploadedFile('bad.gif', gif_bytes.getvalue(), content_type='image/gif')},
            format='multipart',
        )
        self.assertEqual(rejected.status_code, status.HTTP_400_BAD_REQUEST, rejected.data)

    def test_article_category_slug_and_type_are_locked_after_publish(self):
        created = self._create_article()
        article = KnowledgeArticle.objects.get(public_id=created.data['public_id'])
        revision = article.revisions.get(number=1)
        revision.status = KnowledgeArticleRevision.Status.APPROVED
        revision.save(update_fields=['status'])
        article.published_revision = revision
        article.first_published_at = timezone.now()
        article.save(update_fields=['published_revision', 'first_published_at'])

        response = self.client.patch(
            reverse('kb-admin-article-detail', args=[article.public_id]),
            {'revision_token': article.revision_token, 'slug': 'slug-moi'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST, response.data)
        self.assertIn('slug', response.data)
