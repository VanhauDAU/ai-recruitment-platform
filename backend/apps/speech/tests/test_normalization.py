from types import SimpleNamespace

from django.test import SimpleTestCase

from apps.speech.services.normalization import blog_post_speech_script


class BlogSpeechNormalizationTests(SimpleTestCase):
    def test_preserves_blocks_skips_code_urls_and_emotion_cues(self):
        post = SimpleNamespace(
            title='Cẩm nang CV và AI',
            content="""
                <h2>Chuẩn bị CV</h2>
                <p>Đọc <a href="https://example.com/private">hướng dẫn này</a> [cười].</p>
                <p>Không đọc URL thuần https://example.com/tracking?a=1.</p>
                <pre>print("secret")</pre>
                <script>window.secret = true</script>
                <ul><li>Kiểm tra KPI</li><li>Liên hệ HR</li></ul>
                <img src="cover.png" alt="không đọc URL ảnh">
            """,
        )

        result = blog_post_speech_script(post, max_chars=5000)

        self.assertIn('xi vi', result['text'])
        self.assertIn('ây ai', result['text'])
        self.assertIn('Đoạn mã minh họa được lược bỏ.', result['text'])
        self.assertIn('ca pi ai', result['text'])
        self.assertNotIn('https://', result['text'])
        self.assertIn('liên kết', result['text'])
        self.assertNotIn('[cười]', result['text'])
        self.assertNotIn('secret', result['text'])
        self.assertFalse(result['truncated'])
        self.assertEqual(len(result['text_hash']), 64)
        self.assertEqual(result['normalizer_version'], 'blog-speech-v1')

    def test_truncates_only_at_a_readable_boundary(self):
        post = SimpleNamespace(
            title='Bài dài',
            content='<p>' + ('Một câu hoàn chỉnh. ' * 100) + '</p><p>Đoạn sau.</p>',
        )

        result = blog_post_speech_script(post, max_chars=220)

        self.assertTrue(result['truncated'])
        self.assertLessEqual(len(result['text']), 220)
        self.assertTrue(result['text'].endswith('.'))

    def test_truncated_single_block_never_exceeds_limit(self):
        post = SimpleNamespace(title='Một tiêu đề rất dài ' * 30, content='')

        result = blog_post_speech_script(post, max_chars=150)

        self.assertTrue(result['truncated'])
        self.assertLessEqual(len(result['text']), 150)
        self.assertTrue(result['text'].endswith('.'))
