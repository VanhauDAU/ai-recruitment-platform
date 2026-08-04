from types import SimpleNamespace

from django.test import SimpleTestCase

from apps.speech.services.normalization import blog_post_speech_script, plain_text_speech_script


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


class PlainTextSpeechNormalizationTests(SimpleTestCase):
    def test_keeps_each_line_as_its_own_block_and_expands_abbreviations(self):
        result = plain_text_speech_script(
            'Chào bạn\nTôi đã đọc CV của bạn',
            max_chars=600,
        )

        self.assertEqual(result['text'], 'Chào bạn.\n\nTôi đã đọc xi vi của bạn.')
        self.assertEqual(result['normalizer_version'], 'plain-speech-v1')
        self.assertEqual(len(result['text_hash']), 64)
        self.assertFalse(result['truncated'])

    def test_markup_is_parsed_away_instead_of_being_read_aloud(self):
        spoken = plain_text_speech_script('<b>Xin chào</b> bạn', max_chars=600)
        only_markup = plain_text_speech_script(
            '<script>alert(1)</script>',
            max_chars=600,
        )

        self.assertEqual(spoken['text'], 'Xin chào bạn.')
        # Nothing left to say beats announcing a skipped code block: this path
        # narrates one short line, not an article.
        self.assertEqual(only_markup['text'], '')
