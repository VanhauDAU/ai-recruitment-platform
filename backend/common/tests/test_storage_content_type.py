from django.core.files.base import ContentFile
from django.test import SimpleTestCase
from storages.backends.s3 import S3Storage


class PublicMediaContentTypeTests(SimpleTestCase):
    def test_webp_files_are_uploaded_as_images(self):
        # Không có khai báo trong settings, image Python 3.11 ghi application/octet-stream.
        storage = S3Storage(bucket_name='public-media', access_key='test', secret_key='test')

        for name in ('cv-templates/snapshots/tpl/abc-thumbnail.webp', 'blog/thumbnails/x.webp'):
            params = storage._get_write_parameters(name, ContentFile(b'RIFF'))
            self.assertEqual(params['ContentType'], 'image/webp')
        self.assertEqual(
            storage._get_write_parameters('site/logo.png', ContentFile(b''))['ContentType'],
            'image/png',
        )
