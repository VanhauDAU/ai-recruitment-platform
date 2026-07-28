from unittest.mock import patch

from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase

from apps.accounts.models import AdminPermission, AdminRole, Department, User
from apps.accounts.services import assign_membership
from apps.blog.models import BlogMediaAsset, Post, PostCategory, PostWorkingCopy, Tag
from apps.blog.services import sanitize_blog_html


class BlogAdminApiTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.editor = User.objects.create_user(
            email='blog-editor@example.com', password='Password@123', role=User.Role.ADMIN
        )
        cls.publisher = User.objects.create_user(
            email='blog-publisher@example.com', password='Password@123', role=User.Role.ADMIN
        )
        cls.viewer = User.objects.create_user(
            email='blog-viewer@example.com', password='Password@123', role=User.Role.ADMIN
        )
        cls.publisher_only = User.objects.create_user(
            email='blog-publisher-only@example.com',
            password='Password@123',
            role=User.Role.ADMIN,
        )
        department = Department.objects.create(code='blog-content', name='Nội dung')
        editor_role = AdminRole.objects.create(
            department=department, code='editor', name='Biên tập viên'
        )
        publisher_role = AdminRole.objects.create(
            department=department, code='publisher', name='Người duyệt'
        )
        viewer_role = AdminRole.objects.create(
            department=department, code='viewer', name='Người xem'
        )
        publisher_only_role = AdminRole.objects.create(
            department=department, code='publisher-only', name='Chỉ phát hành'
        )
        permissions = {
            code: AdminPermission.objects.create(code=code, module='blog', label=code)
            for code in ('blog.view', 'blog.manage', 'blog.publish')
        }
        editor_role.permissions.add(permissions['blog.view'], permissions['blog.manage'])
        publisher_role.permissions.add(*permissions.values())
        viewer_role.permissions.add(permissions['blog.view'])
        publisher_only_role.permissions.add(
            permissions['blog.view'],
            permissions['blog.publish'],
        )
        assign_membership(cls.editor, editor_role, actor=cls.publisher)
        assign_membership(cls.publisher, publisher_role, actor=cls.publisher)
        assign_membership(cls.viewer, viewer_role, actor=cls.publisher)
        assign_membership(cls.publisher_only, publisher_only_role, actor=cls.publisher)
        cls.category = PostCategory.objects.create(name='Kiến thức nghề nghiệp')

    def _create_draft(self):
        self.client.force_authenticate(self.editor)
        response = self.client.post(
            reverse('blog-admin-post-list'),
            {
                'title': 'Nhân viên kinh doanh/Sales là gì? Từ A đến Z về nghề Sales',
                'category_public_id': self.category.public_id,
                'summary': 'Tổng quan nghề Sales',
                'content': '<h2>Công việc Sales</h2><p>Nội dung</p>',
            },
            format='json',
        )
        self.assertEqual(response.status_code, 201, response.data)
        return response

    def test_slug_is_concise_automatic_and_duplicate_safe(self):
        first = self._create_draft()
        self.assertEqual(first.data['slug'], 'nhan-vien-sales-la-gi')

        second = self._create_draft()
        self.assertEqual(second.data['slug'], 'nhan-vien-sales-la-gi-2')

    def test_viewer_can_read_all_posts_but_cannot_mutate_content(self):
        owned = Post.objects.create(
            title='Bài cũ của người chỉ xem',
            category=self.category,
            author=self.viewer,
            summary='Sapo',
            content='<p>Nội dung</p>',
        )
        other = Post.objects.create(
            title='Bài của biên tập viên khác',
            category=self.category,
            author=self.editor,
            summary='Sapo',
            content='<p>Nội dung</p>',
        )
        self.client.force_authenticate(self.viewer)

        listing = self.client.get(reverse('blog-admin-post-list'))
        self.assertEqual(listing.status_code, 200, listing.data)
        listed_ids = {item['public_id'] for item in listing.data['results']}
        self.assertEqual(listed_ids, {owned.public_id, other.public_id})
        self.assertTrue(all(item['allowed_actions'] == [] for item in listing.data['results']))

        denied_requests = (
            self.client.post(
                reverse('blog-admin-post-list'),
                {
                    'title': 'Không được tạo',
                    'category_public_id': self.category.public_id,
                },
                format='json',
            ),
            self.client.patch(
                reverse('blog-admin-post-draft', args=[owned.public_id]),
                {'title': 'Không được sửa', 'base_revision': 1},
                format='json',
            ),
            self.client.post(
                reverse('blog-admin-post-archive', args=[owned.public_id]),
                {'note': 'Không được ẩn'},
                format='json',
            ),
            self.client.post(
                reverse('blog-admin-category-list'),
                {'name': 'Không được tạo danh mục'},
                format='json',
            ),
            self.client.post(
                reverse('blog-admin-tag-list'),
                {'name': 'Không được tạo thẻ'},
                format='json',
            ),
            self.client.post(reverse('blog-image-upload'), {}, format='multipart'),
            self.client.post(reverse('blog-thumbnail-upload'), {}, format='multipart'),
        )
        self.assertTrue(all(response.status_code == 403 for response in denied_requests))

    def test_list_supports_ordering_for_every_data_column(self):
        later_category = PostCategory.objects.create(name='Xu hướng nghề nghiệp')
        self.editor.full_name = 'An'
        self.editor.save(update_fields=['full_name'])
        self.publisher.full_name = 'Bình'
        self.publisher.save(update_fields=['full_name'])
        first = Post.objects.create(
            title='A — Bài ít hoàn thiện',
            category=self.category,
            author=self.editor,
            summary='',
            content='',
            view_count=10,
        )
        second = Post.objects.create(
            title='Z — Bài hoàn thiện hơn',
            category=later_category,
            author=self.publisher,
            summary='Sapo đầy đủ',
            content='<p>Nội dung đầy đủ</p>',
            thumbnail_url='blog/thumbnail.webp',
            seo_title='SEO title',
            seo_description='SEO description',
            status=Post.Status.PENDING,
            submitted_at=timezone.now(),
            view_count=90,
        )
        self.client.force_authenticate(self.publisher)

        for ordering in (
            'title',
            'category',
            'author',
            'editorial_state',
            'completeness',
            'view_count',
            'updated_at',
        ):
            ascending = self.client.get(
                reverse('blog-admin-post-list'),
                {'ordering': ordering},
            )
            descending = self.client.get(
                reverse('blog-admin-post-list'),
                {'ordering': f'-{ordering}'},
            )
            self.assertEqual(ascending.status_code, 200, ascending.data)
            self.assertEqual(descending.status_code, 200, descending.data)
            self.assertEqual(
                [item['public_id'] for item in ascending.data['results']],
                [first.public_id, second.public_id],
                ordering,
            )
            self.assertEqual(
                [item['public_id'] for item in descending.data['results']],
                [second.public_id, first.public_id],
                ordering,
            )

    def test_publish_permission_can_edit_and_moderate_posts_but_cannot_create(self):
        pending = Post.objects.create(
            title='Bài đang chờ duyệt',
            category=self.category,
            author=self.editor,
            summary='Sapo đủ điều kiện xuất bản',
            content='<h2>Nội dung</h2><p>Chi tiết</p>',
            status=Post.Status.PENDING,
            submitted_at=timezone.now(),
        )
        archived = Post.objects.create(
            title='Bài đã gỡ',
            category=self.category,
            author=self.editor,
            summary='Sapo',
            content='<p>Nội dung</p>',
            status=Post.Status.ARCHIVED,
        )
        draft = Post.objects.create(
            title='Bài nháp của biên tập viên',
            category=self.category,
            author=self.editor,
            summary='Sapo cũ',
            content='<h2>Nội dung</h2><p>Chi tiết</p>',
        )
        self.client.force_authenticate(self.publisher_only)

        detail = self.client.get(reverse('blog-admin-post-detail', args=[pending.public_id]))
        self.assertEqual(detail.status_code, 200, detail.data)
        self.assertIn('edit', detail.data['allowed_actions'])
        self.assertIn('submit', detail.data['allowed_actions'])
        self.assertIn('publish', detail.data['allowed_actions'])
        self.assertIn('return', detail.data['allowed_actions'])
        self.assertIn('archive', detail.data['allowed_actions'])

        denied_create = self.client.post(reverse('blog-admin-post-list'), {}, format='json')
        edited_pending = self.client.patch(
            reverse('blog-admin-post-draft', args=[pending.public_id]),
            {'summary': 'Người duyệt đã cập nhật trước khi xuất bản', 'base_revision': 1},
            format='json',
        )
        resubmitted_pending = self.client.post(
            reverse('blog-admin-post-submit', args=[pending.public_id]),
            {},
            format='json',
        )
        edited = self.client.patch(
            reverse('blog-admin-post-draft', args=[draft.public_id]),
            {'summary': 'Người duyệt đã chỉnh nội dung', 'base_revision': 1},
            format='json',
        )
        restored = self.client.post(
            reverse('blog-admin-post-restore', args=[archived.public_id]),
            {},
            format='json',
        )
        content_upload = self.client.post(reverse('blog-image-upload'), {}, format='multipart')
        thumbnail_upload = self.client.post(
            reverse('blog-thumbnail-upload'),
            {},
            format='multipart',
        )
        self.assertEqual(denied_create.status_code, 403)
        self.assertEqual(edited_pending.status_code, 200, edited_pending.data)
        self.assertEqual(resubmitted_pending.status_code, 200, resubmitted_pending.data)
        self.assertEqual(resubmitted_pending.data['editorial_state'], 'pending')
        self.assertEqual(edited.status_code, 200, edited.data)
        self.assertEqual(
            edited.data['editable_version']['summary'], 'Người duyệt đã chỉnh nội dung'
        )
        self.assertEqual(restored.status_code, 200, restored.data)
        self.assertEqual(restored.data['editorial_state'], 'draft')
        self.assertEqual(content_upload.status_code, 400, content_upload.data)
        self.assertEqual(thumbnail_upload.status_code, 400, thumbnail_upload.data)

        published = self.client.post(
            reverse('blog-admin-post-publish', args=[pending.public_id]),
            {},
            format='json',
        )
        self.assertEqual(published.status_code, 200, published.data)
        self.assertEqual(published.data['editorial_state'], 'published')

    def test_editor_sees_and_edits_all_posts_and_rejects_stale_revision(self):
        created = self._create_draft()
        other = Post.objects.create(
            title='Bài của người khác',
            category=self.category,
            author=self.publisher,
            summary='Sapo cũ',
            content='<p>Nội dung</p>',
        )

        listing = self.client.get(reverse('blog-admin-post-list'))
        self.assertEqual(listing.status_code, 200)
        listed = {item['public_id']: item for item in listing.data['results']}
        self.assertEqual(set(listed), {created.data['public_id'], other.public_id})
        self.assertIn('edit', listed[created.data['public_id']]['allowed_actions'])
        self.assertIn('edit', listed[other.public_id]['allowed_actions'])

        saved_other = self.client.patch(
            reverse('blog-admin-post-draft', args=[other.public_id]),
            {'summary': 'Đã phối hợp sửa bài của đồng nghiệp', 'base_revision': 1},
            format='json',
        )
        submitted_other = self.client.post(
            reverse('blog-admin-post-submit', args=[other.public_id]),
            {},
            format='json',
        )
        self.assertEqual(saved_other.status_code, 200, saved_other.data)
        self.assertEqual(submitted_other.status_code, 200, submitted_other.data)
        self.assertEqual(submitted_other.data['editorial_state'], 'pending')
        self.assertIn('edit', submitted_other.data['allowed_actions'])
        self.assertIn('submit', submitted_other.data['allowed_actions'])

        pending_revision = submitted_other.data['editable_version']['edit_revision']
        edited_while_pending = self.client.patch(
            reverse('blog-admin-post-draft', args=[other.public_id]),
            {
                'summary': 'Tiếp tục sửa sau khi đã gửi duyệt',
                'base_revision': pending_revision,
            },
            format='json',
        )
        resent = self.client.post(
            reverse('blog-admin-post-submit', args=[other.public_id]),
            {},
            format='json',
        )
        self.assertEqual(edited_while_pending.status_code, 200, edited_while_pending.data)
        self.assertEqual(resent.status_code, 200, resent.data)
        self.assertEqual(resent.data['editorial_state'], 'pending')

        url = reverse('blog-admin-post-draft', args=[created.data['public_id']])
        saved = self.client.patch(
            url,
            {'summary': 'Bản lưu mới', 'base_revision': 1},
            format='json',
        )
        self.assertEqual(saved.status_code, 200, saved.data)
        self.assertEqual(saved.data['editable_version']['edit_revision'], 2)

        stale = self.client.patch(
            url,
            {'summary': 'Ghi đè từ tab cũ', 'base_revision': 1},
            format='json',
        )
        self.assertEqual(stale.status_code, 409, stale.data)
        self.assertEqual(stale.data['code'], 'blog_resource_changed')

    def test_published_revision_stays_private_until_publisher_approves(self):
        post = Post.objects.create(
            title='Tiêu đề đang hiển thị',
            category=self.category,
            author=self.editor,
            summary='Sapo đang hiển thị',
            content='<p>Nội dung đang hiển thị</p>',
            status=Post.Status.PUBLISHED,
            published_at=timezone.now(),
        )
        self.client.force_authenticate(self.editor)
        draft_url = reverse('blog-admin-post-draft', args=[post.public_id])
        revised = self.client.patch(
            draft_url,
            {
                'title': 'Tiêu đề mới chưa duyệt',
                'summary': 'Sapo mới',
                'content': '<p>Nội dung mới</p>',
                'base_revision': 1,
            },
            format='json',
        )
        self.assertEqual(revised.status_code, 200, revised.data)
        self.assertTrue(PostWorkingCopy.objects.filter(post=post).exists())

        public_before = self.client.get(reverse('blog-post-detail', args=[post.slug]))
        self.assertEqual(public_before.data['title'], 'Tiêu đề đang hiển thị')

        submitted = self.client.post(reverse('blog-admin-post-submit', args=[post.public_id]), {})
        self.assertEqual(submitted.status_code, 200, submitted.data)

        edited_pending_copy = self.client.patch(
            draft_url,
            {
                'title': 'Tiêu đề mới nhất sau khi gửi duyệt',
                'base_revision': submitted.data['editable_version']['edit_revision'],
            },
            format='json',
        )
        self.assertEqual(edited_pending_copy.status_code, 200, edited_pending_copy.data)
        resubmitted = self.client.post(reverse('blog-admin-post-submit', args=[post.public_id]), {})
        self.assertEqual(resubmitted.status_code, 200, resubmitted.data)
        self.assertEqual(resubmitted.data['editorial_state'], 'published_with_pending')

        self.client.force_authenticate(self.publisher)
        published = self.client.post(reverse('blog-admin-post-publish', args=[post.public_id]), {})
        self.assertEqual(published.status_code, 200, published.data)

        public_after = self.client.get(reverse('blog-post-detail', args=[post.slug]))
        self.assertEqual(public_after.data['title'], 'Tiêu đề mới nhất sau khi gửi duyệt')
        self.assertFalse(PostWorkingCopy.objects.filter(post=post).exists())

    def test_archive_requires_a_reason_hides_public_post_and_can_restore_to_draft(self):
        post = Post.objects.create(
            title='Bài đang hiển thị cần được ẩn',
            category=self.category,
            author=self.editor,
            summary='Sapo đang hiển thị',
            content='<p>Nội dung đang hiển thị</p>',
            status=Post.Status.PUBLISHED,
            published_at=timezone.now(),
        )
        self.client.force_authenticate(self.publisher)
        archive_url = reverse('blog-admin-post-archive', args=[post.public_id])

        missing_reason = self.client.post(archive_url, {}, format='json')
        self.assertEqual(missing_reason.status_code, 400, missing_reason.data)

        archived = self.client.post(
            archive_url,
            {'note': 'Nội dung cần rà soát lại'},
            format='json',
        )
        self.assertEqual(archived.status_code, 200, archived.data)
        self.assertEqual(archived.data['editorial_state'], 'archived')
        self.assertIn('restore', archived.data['allowed_actions'])

        public = self.client.get(reverse('blog-post-detail', args=[post.slug]))
        self.assertEqual(public.status_code, 404)

        restored = self.client.post(
            reverse('blog-admin-post-restore', args=[post.public_id]),
            {},
            format='json',
        )
        self.assertEqual(restored.status_code, 200, restored.data)
        self.assertEqual(restored.data['editorial_state'], 'draft')
        self.assertIn('submit', restored.data['allowed_actions'])

    def test_quick_create_normalizes_tag_and_rejects_duplicates(self):
        self.client.force_authenticate(self.editor)
        created = self.client.post(
            reverse('blog-admin-tag-list'),
            {'name': 'nghề sales'},
            format='json',
        )
        self.assertEqual(created.status_code, 201, created.data)
        self.assertEqual(created.data['name'], 'Nghề Sales')
        self.assertEqual(created.data['slug'], 'nghe-sales')
        self.assertTrue(created.data['is_active'])

        duplicate = self.client.post(
            reverse('blog-admin-tag-list'),
            {'name': 'Nghề Sales'},
            format='json',
        )
        self.assertEqual(duplicate.status_code, 400, duplicate.data)

    def test_tag_can_be_hidden_and_merged_without_losing_associations(self):
        source = Tag.objects.create(name='Sale', slug='sale')
        target = Tag.objects.create(name='Sales', slug='sales')
        post = Post.objects.create(
            title='Bài có thẻ',
            category=self.category,
            author=self.editor,
            content='<p>Nội dung</p>',
            status=Post.Status.PUBLISHED,
            published_at=timezone.now(),
        )
        post.tags.add(source)
        working_copy = PostWorkingCopy.objects.create(
            post=post,
            title=post.title,
            category=self.category,
            content=post.content,
            created_by=self.editor,
            updated_by=self.editor,
        )
        working_copy.tags.add(source)
        self.client.force_authenticate(self.editor)

        hidden = self.client.patch(
            reverse('blog-admin-tag-detail', args=[source.public_id]),
            {'is_active': False, 'slug': 'sale-cu'},
            format='json',
        )
        self.assertEqual(hidden.status_code, 200, hidden.data)
        self.assertFalse(hidden.data['is_active'])
        self.assertEqual(hidden.data['slug'], 'sale-cu')

        public = self.client.get(reverse('blog-post-detail', args=[post.slug]))
        self.assertEqual(public.status_code, 200)
        self.assertEqual(public.data['tags'], [])

        merged = self.client.post(
            reverse('blog-admin-tag-merge', args=[source.public_id]),
            {'target_public_id': target.public_id},
            format='json',
        )
        self.assertEqual(merged.status_code, 200, merged.data)
        self.assertFalse(Tag.objects.filter(pk=source.pk).exists())
        self.assertTrue(post.tags.filter(pk=target.pk).exists())
        self.assertTrue(working_copy.tags.filter(pk=target.pk).exists())
        self.assertEqual(merged.data['usage_count'], 2)

    @patch('apps.blog.services.media.save_image_upload')
    def test_uploaded_content_image_is_available_in_searchable_media_library(self, save_image):
        save_image.return_value = {
            'path': 'blog/content/sales.webp',
            'url': 'http://testserver/media/blog/content/sales.webp',
            'content_type': 'image/webp',
            'size': 15360,
            'name': 'anh-nghe-sales.webp',
        }
        self.client.force_authenticate(self.editor)
        uploaded = self.client.post(
            reverse('blog-image-upload'),
            {'file': SimpleUploadedFile('anh-nghe-sales.webp', b'image', 'image/webp')},
            format='multipart',
        )
        self.assertEqual(uploaded.status_code, 201, uploaded.data)
        self.assertEqual(uploaded.data['original_name'], 'anh-nghe-sales.webp')
        self.assertEqual(BlogMediaAsset.objects.get().uploaded_by, self.editor)

        listing = self.client.get(reverse('blog-image-upload'), {'q': 'nghe-sales'})
        self.assertEqual(listing.status_code, 200, listing.data)
        self.assertEqual(listing.data['count'], 1)
        self.assertEqual(listing.data['results'][0]['public_id'], uploaded.data['public_id'])

    def test_image_layout_attributes_are_sanitized_with_an_allowlist(self):
        safe = sanitize_blog_html(
            '<img src="/media/a.webp" alt="Sales" data-width="50%" data-align="right">'
        )
        self.assertIn('data-width="50%"', safe)
        self.assertIn('data-align="right"', safe)

        normalized = sanitize_blog_html(
            '<img src="/media/a.webp" data-width="999px" data-align="fixed">'
        )
        self.assertIn('data-width="100%"', normalized)
        self.assertIn('data-align="center"', normalized)

    def test_published_post_can_be_pinned_updated_reordered_and_removed(self):
        first = Post.objects.create(
            title='Bài ghim thứ nhất',
            category=self.category,
            author=self.editor,
            content='<p>Nội dung</p>',
            status=Post.Status.PUBLISHED,
            published_at=timezone.now(),
        )
        second = Post.objects.create(
            title='Bài ghim thứ hai',
            category=self.category,
            author=self.editor,
            content='<p>Nội dung</p>',
            status=Post.Status.PUBLISHED,
            published_at=timezone.now(),
        )
        self.client.force_authenticate(self.editor)
        url = reverse('blog-admin-pin-list')
        created_first = self.client.post(url, {'post_public_id': first.public_id}, format='json')
        created_second = self.client.post(url, {'post_public_id': second.public_id}, format='json')
        self.assertEqual(created_first.status_code, 201, created_first.data)
        self.assertEqual(created_second.status_code, 201, created_second.data)

        hidden = self.client.patch(
            reverse('blog-admin-pin-detail', args=[created_first.data['public_id']]),
            {'is_active': False},
            format='json',
        )
        self.assertEqual(hidden.status_code, 200, hidden.data)

        reordered = self.client.post(
            reverse('blog-admin-pin-reorder'),
            {
                'public_ids': [
                    created_second.data['public_id'],
                    created_first.data['public_id'],
                ]
            },
            format='json',
        )
        self.assertEqual(reordered.status_code, 200, reordered.data)

        removed = self.client.delete(
            reverse('blog-admin-pin-detail', args=[created_first.data['public_id']])
        )
        self.assertEqual(removed.status_code, 204, removed.data)
