"""Page content that publishes at once and is reviewed afterwards."""

from unittest.mock import patch

from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse

from apps.accounts.models import User
from apps.jobs.models import Benefit

from ..models import (
    Company,
    CompanyContentChange,
    CompanyImage,
    CompanyPageEvent,
    CompanyUpdateRequest,
    EmployerNotification,
)
from ..selectors import admin_company_summary
from ..services import start_company_update_review
from .cases import MEMBER, CompanyPageWorkspaceTestCase
from .factories import PNG_BYTES, add_recruiter

CULTURE = '<p>Làm việc <strong>minh bạch</strong>.</p>'
DELETE_MEDIA = 'apps.employers.services.company_content_changes.delete_local_media_url'


class ContentChangeTestCase(CompanyPageWorkspaceTestCase):
    def setUp(self):
        super().setUp()
        self.content_url = reverse('employer-company-page-content')
        self.admin = User.objects.create_superuser(email='content-admin@example.com', password='x')
        self.insurance = Benefit.objects.create(name='Bảo hiểm sức khoẻ CCH', icon='shield')

    def send(self, **changes):
        return self.client.post(self.content_url, {'changes': changes}, format='json')

    def upload_logo(self, content_change):
        return self.client.post(
            reverse('employer-company-logo-upload'),
            {
                'file': SimpleUploadedFile('logo.png', PNG_BYTES, content_type='image/png'),
                'content_change': content_change,
            },
            format='multipart',
        )

    def as_admin(self):
        self.client.force_authenticate(self.admin)

    def changes_url(self, *args, name='admin-company-content-change-list'):
        return reverse(name, args=args)


class DirectPublishTests(ContentChangeTestCase):
    def test_a_save_publishes_at_once_and_logs_what_it_replaced(self):
        response = self.send(
            headline='Kiến tạo tương lai',
            culture=CULTURE,
            benefits=[{'benefit_id': self.insurance.id, 'note': 'Cả gia đình'}],
        )

        self.assertEqual(response.status_code, 200, response.data)
        self.company.refresh_from_db()
        self.assertEqual(self.company.headline, 'Kiến tạo tương lai')
        self.assertEqual(self.company.culture, CULTURE)
        self.assertEqual(
            list(self.company.benefit_items.values_list('benefit_id', 'note')),
            [(self.insurance.id, 'Cả gia đình')],
        )
        change = CompanyContentChange.objects.get()
        self.assertEqual(response.data['content_change'], change.public_id)
        self.assertEqual(change.actor, self.owner)
        self.assertEqual(change.status, CompanyContentChange.Status.UNREVIEWED)
        self.assertEqual(change.previous, {'headline': '', 'culture': '', 'benefits': []})
        self.assertFalse(CompanyUpdateRequest.objects.exists())
        form = response.data['content_form']
        self.assertEqual(form['review_mode'], 'direct')
        self.assertEqual(form['section_status']['hero'], 'published')
        self.assertIsNone(form['request'])

    def test_a_save_that_changes_nothing_is_refused(self):
        response = self.send(headline='')

        self.assertEqual(response.status_code, 400)
        self.assertFalse(CompanyContentChange.objects.exists())

    def test_only_an_effective_editor_may_publish(self):
        self.client.force_authenticate(self.member)

        self.assertEqual(self.send(headline='Không được').status_code, 403)
        self.assertFalse(CompanyContentChange.objects.exists())

    def test_gallery_deletion_keeps_the_row_data_for_a_revert(self):
        image = CompanyImage.objects.get(company=self.company)

        response = self.send(gallery_deletions=[image.id])

        self.assertEqual(response.status_code, 200, response.data)
        self.assertFalse(CompanyImage.objects.filter(pk=image.pk).exists())
        change = CompanyContentChange.objects.get()
        self.assertEqual(change.previous['gallery_deletions'][0]['image_url'], image.image_url)

    def test_a_logo_uploads_against_the_change_that_announced_it(self):
        Company.objects.filter(pk=self.company.pk).update(logo_url='employers/alpha/old.png')
        marked = self.send(logo_pending=True)
        change_id = marked.data['content_change']

        with patch('apps.employers.services.company_media.delete_local_media_url') as delete:
            uploaded = self.upload_logo(change_id)
        again = self.upload_logo(change_id)

        self.assertEqual(uploaded.status_code, 200, uploaded.data)
        change = CompanyContentChange.objects.get(public_id=change_id)
        self.company.refresh_from_db()
        self.assertEqual(self.company.logo_url, change.changes['logo_url'])
        self.assertEqual(change.previous['logo_url'], 'employers/alpha/old.png')
        self.assertEqual(change.pending_media, [])
        # The replaced logo stays on disk until the change is reviewed.
        delete.assert_not_called()
        self.assertEqual(again.status_code, 400)
        self.assertIn('content_change', again.data)

    def test_another_editor_cannot_upload_into_my_change(self):
        editor = add_recruiter(self.company, role=MEMBER)
        self.grant(editor)
        change_id = self.send(logo_pending=True).data['content_change']
        self.client.force_authenticate(editor)

        self.assertEqual(self.upload_logo(change_id).status_code, 400)

    def test_publishing_drops_the_same_keys_from_my_open_request(self):
        Company.objects.filter(pk=self.company.pk).update(content_review_required=True)
        self.send(headline='Chờ duyệt', culture=CULTURE)
        Company.objects.filter(pk=self.company.pk).update(content_review_required=False)

        published = self.send(headline='Đăng ngay')

        self.assertEqual(published.status_code, 200, published.data)
        request = CompanyUpdateRequest.objects.get()
        self.assertEqual(request.changes, {'culture': CULTURE})
        self.assertEqual(published.data['content_form']['section_status']['hero'], 'published')
        self.assertEqual(published.data['content_form']['section_status']['culture'], 'pending')
        self.send(culture='<p>Khác</p>')
        request.refresh_from_db()
        self.assertEqual(request.status, CompanyUpdateRequest.Status.WITHDRAWN)

    def test_keys_of_my_request_in_review_stay_locked(self):
        Company.objects.filter(pk=self.company.pk).update(content_review_required=True)
        self.send(culture=CULTURE)
        Company.objects.filter(pk=self.company.pk).update(content_review_required=False)
        request = CompanyUpdateRequest.objects.get()
        start_company_update_review(request, actor=self.admin, lock_version=request.lock_version)

        locked = self.send(culture='<p>Khác</p>')
        other = self.send(headline='Khối khác vẫn lưu được')

        self.assertEqual(locked.status_code, 409)
        self.assertEqual(other.status_code, 200, other.data)

    def test_review_first_companies_still_go_through_an_update_request(self):
        Company.objects.filter(pk=self.company.pk).update(content_review_required=True)

        response = self.send(headline='Chờ duyệt')

        self.assertEqual(response.status_code, 200, response.data)
        self.assertIsNone(response.data['content_change'])
        self.assertEqual(response.data['content_form']['review_mode'], 'review')
        self.assertEqual(CompanyUpdateRequest.objects.get().changes, {'headline': 'Chờ duyệt'})
        self.company.refresh_from_db()
        self.assertEqual(self.company.headline, '')


class AdminContentChangeTests(ContentChangeTestCase):
    def test_list_shows_unreviewed_changes_with_readable_values(self):
        self.send(benefits=[{'benefit_id': self.insurance.id, 'note': 'Cả nhà'}])
        self.send(logo_pending=True)  # announced, never uploaded: nothing to review
        self.as_admin()

        response = self.client.get(self.changes_url())

        self.assertEqual(response.status_code, 200, response.data)
        [row] = response.data['results']
        self.assertEqual(row['company']['public_id'], self.company.public_id)
        self.assertEqual(row['sections'], ['benefits'])
        self.assertEqual(
            row['changed_fields'],
            [
                {
                    'field': 'benefits',
                    'label': 'Phúc lợi',
                    'kind': 'list',
                    'before': [],
                    'after': ['Bảo hiểm sức khoẻ CCH — Cả nhà'],
                }
            ],
        )
        self.assertEqual(admin_company_summary()['unreviewed_content_changes'], 1)

    def test_list_needs_the_admin_portal(self):
        self.assertEqual(self.client.get(self.changes_url()).status_code, 403)

    def test_mark_reviewed_closes_changes_and_drops_replaced_files(self):
        Company.objects.filter(pk=self.company.pk).update(logo_url='employers/alpha/old.png')
        change_id = self.send(logo_pending=True).data['content_change']
        self.upload_logo(change_id)
        self.as_admin()

        with patch(DELETE_MEDIA) as delete, self.captureOnCommitCallbacks(execute=True):
            response = self.client.post(
                self.changes_url(name='admin-company-content-change-mark-reviewed'),
                {'public_ids': [change_id]},
                format='json',
            )

        self.assertEqual(response.data, {'count': 1})
        change = CompanyContentChange.objects.get(public_id=change_id)
        self.assertEqual(change.status, CompanyContentChange.Status.REVIEWED)
        self.assertEqual(change.reviewed_by, self.admin)
        delete.assert_called_once_with('employers/alpha/old.png')

    def test_revert_restores_the_page_and_tells_the_editor_why(self):
        Company.objects.filter(pk=self.company.pk).update(logo_url='employers/alpha/old.png')
        image = CompanyImage.objects.get(company=self.company)
        first = self.send(headline='Nội dung sai', gallery_deletions=[image.id])
        logo_change = self.send(logo_pending=True).data['content_change']
        self.upload_logo(logo_change)
        new_logo = Company.objects.get(pk=self.company.pk).logo_url
        self.as_admin()
        url = self.changes_url(
            first.data['content_change'], name='admin-company-content-change-revert'
        )

        reverted = self.client.post(
            url, {'reason': 'Khẩu hiệu gây hiểu nhầm về quy mô.'}, format='json'
        )
        with patch(DELETE_MEDIA) as delete, self.captureOnCommitCallbacks(execute=True):
            logo_reverted = self.client.post(
                self.changes_url(logo_change, name='admin-company-content-change-revert'),
                {'reason': 'Logo không phải của công ty.', 'require_review': True},
                format='json',
            )

        self.assertEqual(reverted.status_code, 200, reverted.data)
        self.assertEqual(reverted.data['status'], 'reverted')
        self.company.refresh_from_db()
        self.assertEqual(self.company.headline, '')
        self.assertEqual(
            list(self.company.images.values_list('image_url', flat=True)), [image.image_url]
        )
        self.assertEqual(logo_reverted.status_code, 200, logo_reverted.data)
        self.assertEqual(self.company.logo_url, 'employers/alpha/old.png')
        delete.assert_called_once_with(new_logo)
        self.assertTrue(self.company.content_review_required)
        self.assertTrue(
            CompanyPageEvent.objects.filter(
                company=self.company,
                event_type=CompanyPageEvent.EventType.CONTENT_REVIEW_REQUIRED,
            ).exists()
        )
        notification = EmployerNotification.objects.get(
            recipient=self.owner,
            event_type=EmployerNotification.EventType.COMPANY_CONTENT_REVERTED,
            dedupe_key__endswith=first.data['content_change'],
        )
        self.assertEqual(notification.message, 'Khẩu hiệu gây hiểu nhầm về quy mô.')

    def test_revert_refuses_a_change_a_newer_one_overwrote(self):
        older = self.send(headline='Bản một').data['content_change']
        self.send(headline='Bản hai')
        self.as_admin()

        response = self.client.post(
            self.changes_url(older, name='admin-company-content-change-revert'),
            {'reason': 'Không phù hợp với trang.'},
            format='json',
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data['fields'], ['headline'])
        self.assertEqual(Company.objects.get(pk=self.company.pk).headline, 'Bản hai')

    def test_admin_toggles_review_first_on_the_company(self):
        self.as_admin()
        url = reverse('admin-company-content-review', args=[self.company.public_id])

        required = self.client.post(
            url, {'action': 'require', 'reason': 'Nhiều báo cáo về nội dung.'}, format='json'
        )
        again = self.client.post(
            url, {'action': 'require', 'reason': 'Nhiều báo cáo về nội dung.'}, format='json'
        )
        released = self.client.post(
            url, {'action': 'release', 'reason': 'Đã rà soát xong nội dung.'}, format='json'
        )

        self.assertEqual(required.status_code, 200, required.data)
        self.assertTrue(required.data['content_review_required'])
        self.assertEqual(again.status_code, 400)
        self.assertFalse(released.data['content_review_required'])


class AdminQueueCountTests(ContentChangeTestCase):
    def test_requests_waiting_on_the_employer_leave_the_admin_backlog(self):
        Company.objects.filter(pk=self.company.pk).update(content_review_required=True)
        self.send(headline='Chờ duyệt')
        self.assertEqual(admin_company_summary()['pending_update_requests'], 1)

        CompanyUpdateRequest.objects.update(status=CompanyUpdateRequest.Status.CHANGES_REQUESTED)

        self.assertEqual(admin_company_summary()['pending_update_requests'], 0)
