from types import SimpleNamespace

from django.test import SimpleTestCase

from ..schemas import empty_content, empty_layout, empty_style
from ..services.pdf_renderer import build_cv_pdf_html


class CvPdfRendererCompatibilityTests(SimpleTestCase):
    def version_with_summary(self, description):
        content = empty_content()
        content['sections'] = [
            {
                'instance_id': 'summary_1',
                'section_key': 'summary',
                'title': 'Mục tiêu nghề nghiệp',
                'enabled': True,
                'items': [
                    {
                        'item_id': 'summary_item_1',
                        'description': description,
                    }
                ],
            }
        ]
        layout = empty_layout()
        layout['regions'][0]['section_instance_ids'] = ['summary_1']
        return SimpleNamespace(
            template_version=SimpleNamespace(
                renderer_key='classic_single_column_v1',
                renderer_version='1',
            ),
            schema_version=1,
            content_json=content,
            layout_json=layout,
            style_json=empty_style(),
        )

    def test_summary_preserves_the_same_rich_text_marks_as_other_sections(self):
        version = self.version_with_summary(
            {
                'format': 'rich_text_v2',
                'content': [
                    {
                        'type': 'paragraph',
                        'text': 'Đậm nghiêng màu',
                        'runs': [
                            {'text': 'Đậm', 'marks': {'bold': True}},
                            {
                                'text': ' nghiêng',
                                'marks': {'italic': True, 'underline': True},
                            },
                            {
                                'text': ' màu',
                                'marks': {
                                    'color': '#2255AA',
                                    'font_family': 'Inter',
                                    'font_size_pt': 12,
                                },
                            },
                        ],
                    }
                ],
            }
        )

        html = build_cv_pdf_html(version)

        self.assertIn('<strong>Đậm</strong>', html)
        self.assertIn('<em><u> nghiêng</u></em>', html)
        self.assertIn('font-family:Inter;font-size:12pt;color:#2255AA;', html)

    def test_rich_text_remains_html_escaped_at_the_renderer_boundary(self):
        version = self.version_with_summary(
            {
                'format': 'rich_text_v2',
                'content': [
                    {
                        'type': 'paragraph',
                        'text': '<script>alert("x")</script> & candidate',
                        'runs': [
                            {
                                'text': '<script>alert("x")</script> & candidate',
                            }
                        ],
                    }
                ],
            }
        )

        html = build_cv_pdf_html(version)

        self.assertNotIn('<script>', html)
        self.assertIn('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; candidate', html)
