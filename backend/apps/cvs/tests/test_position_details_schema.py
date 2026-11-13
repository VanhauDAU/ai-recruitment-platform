"""Kiểm tra section `position_details` và `degree_level` trong document (CVT-3)."""

from django.core.exceptions import ValidationError
from django.test import SimpleTestCase

from ..schemas import empty_content, empty_layout, empty_style, validate_cv_document


def detail(field_type, value, **extra):
    return {
        'item_id': f'position_details_item_{field_type}',
        'field_key': f'field_{field_type}',
        'label': 'Nhãn',
        'field_type': field_type,
        'value': value,
        **extra,
    }


def validate(*items, section_key='position_details'):
    content = empty_content()
    content['sections'] = [
        {
            'instance_id': f'{section_key}_1',
            'section_key': section_key,
            'title': 'Mục',
            'enabled': True,
            'items': list(items),
        }
    ]
    layout = empty_layout()
    layout['regions'][0]['section_instance_ids'] = [f'{section_key}_1']
    validate_cv_document(
        content_json=content, layout_json=layout, style_json=empty_style(), schema_version=1
    )


class PositionDetailsSchemaTests(SimpleTestCase):
    def test_values_matching_their_type_are_accepted(self):
        options = ['B2B', 'B2C']
        validate(
            detail('text', 'Một triệu người dùng'),
            detail('long_text', ''),
            detail('url', 'https://github.com/example'),
            detail('number', 12.5),
            detail('date', '2024-05'),
            detail('select', 'B2B', options=options),
            detail('multi_select', ['B2B', 'B2C'], options=options),
            detail('tags', ['Python', 'Django'], maps_to='skills'),
            {**detail('url', None), 'item_id': 'position_details_item_empty_url'},
        )

    def test_values_of_the_wrong_type_or_outside_options_are_rejected(self):
        cases = [
            detail('url', 'javascript:alert(1)'),
            detail('number', '12'),
            detail('date', '2024/05'),
            detail('select', 'Khác', options=['B2B']),
            detail('multi_select', ['Khác'], options=['B2B']),
            detail('tags', ['x' * 61]),
            detail('text', 'x' * 201),
            detail('unknown', 'x'),
            {**detail('text', 'x'), 'field_key': 'Bad Key'},
            {**detail('tags', []), 'maps_to': 'salary'},
        ]
        for item in cases:
            with self.subTest(item=item), self.assertRaises(ValidationError):
                validate(item)

    def test_education_degree_level_uses_the_job_vocabulary(self):
        validate(
            {'item_id': 'education_item_1', 'degree_level': 'university'}, section_key='education'
        )
        with self.assertRaises(ValidationError):
            validate(
                {'item_id': 'education_item_1', 'degree_level': 'phd'}, section_key='education'
            )
