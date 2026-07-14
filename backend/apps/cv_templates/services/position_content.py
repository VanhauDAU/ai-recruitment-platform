"""Resolve deterministic, renderer-neutral CV starter content for a position."""

from copy import deepcopy

from apps.jobs.models import JobCategory, JobCategoryLocalization

from ..models import CvContentBlueprint, CvSampleContent


class PositionContentUnavailable(ValueError):
    """Required localized/configured content is not published for this selection."""


def _rich_text(value):
    return {
        'format': 'rich_text_v1',
        'content': [
            {'type': 'paragraph', 'text': line}
            for line in value.split('\n')
            if line
        ],
    }


def _format(value, position_name):
    return value.replace('{position}', position_name)


def _localized_name(position, locale):
    localization = JobCategoryLocalization.objects.filter(
        category=position,
        locale=locale,
        is_active=True,
    ).first()
    if localization:
        return localization.display_name
    raise PositionContentUnavailable(f'Vị trí chưa được cấu hình nội dung cho ngôn ngữ {locale}.')


def _name_vi(position):
    localization = JobCategoryLocalization.objects.filter(
        category=position,
        locale=JobCategoryLocalization.Locale.VI,
        is_active=True,
    ).first()
    return localization.display_name if localization else position.name


def _blueprint(locale, experience_level):
    blueprint = CvContentBlueprint.objects.filter(
        locale=locale,
        experience_level=experience_level,
        is_active=True,
    ).first()
    if blueprint is None and experience_level != 'unspecified':
        blueprint = CvContentBlueprint.objects.filter(
            locale=locale,
            experience_level='unspecified',
            is_active=True,
        ).first()
    if blueprint is None:
        raise PositionContentUnavailable(f'Chưa có blueprint CV active cho ngôn ngữ {locale}.')
    return blueprint


def _content_from_blueprint(blueprint, locale, position_name):
    return {
        'schema_version': 1,
        'locale': locale,
        'personal_info': {
            'full_name': '',
            'headline': position_name,
            'email': '',
            'phone': '',
            'address': '',
            'avatar_asset_id': None,
            'links': [],
        },
        'sections': [
            {
                'instance_id': 'summary_1',
                'section_key': 'summary',
                'title': blueprint.summary_title,
                'enabled': True,
                'items': [{
                    'item_id': 'summary_item_1',
                    'value': _format(blueprint.summary_template, position_name),
                }],
            },
            {
                'instance_id': 'experience_1',
                'section_key': 'experience',
                'title': blueprint.experience_title,
                'enabled': True,
                'items': [{
                    'item_id': 'experience_item_1',
                    'role': position_name,
                    'company': blueprint.experience_company,
                    'start_date': '2022-03',
                    'end_date': None,
                    'description': _rich_text(_format(
                        blueprint.experience_description_template,
                        position_name,
                    )),
                }],
            },
            {
                'instance_id': 'education_1',
                'section_key': 'education',
                'title': blueprint.education_title,
                'enabled': True,
                'items': [{
                    'item_id': 'education_item_1',
                    'degree': blueprint.education_degree,
                    'institution': blueprint.education_institution,
                    'start_date': '2016-09',
                    'end_date': '2020-06',
                    'description': _rich_text(blueprint.education_description),
                }],
            },
            {
                'instance_id': 'skills_1',
                'section_key': 'skills',
                'title': blueprint.skills_title,
                'enabled': True,
                'items': [
                    {
                        'item_id': f'skills_item_{index + 1}',
                        'name': _format(skill, position_name),
                        'level': '',
                    }
                    for index, skill in enumerate(blueprint.skill_templates)
                ],
            },
        ],
        'custom_fields': {},
    }


def resolve_position_content(*, position, locale, experience_level='unspecified', lock=False):
    """Return a curated override or materialize a generic localized blueprint."""
    if (
        position.status != JobCategory.Status.ACTIVE
        or position.category_type != JobCategory.CategoryType.SPECIALIZATION
    ):
        raise PositionContentUnavailable('Vị trí chuyên môn không hoạt động.')

    samples = CvSampleContent.objects.filter(
        job_category=position,
        locale=locale,
        experience_level=experience_level,
        status=CvSampleContent.Status.PUBLISHED,
    )
    if lock:
        samples = samples.select_for_update()
    sample = samples.first()
    if sample:
        return {
            'position_public_id': position.public_id,
            'name_vi': _name_vi(position),
            'locale': locale,
            'experience_level': experience_level,
            'source': 'curated',
            'sample_content_public_id': sample.public_id,
            'schema_version': sample.schema_version,
            'content_json': deepcopy(sample.content_json),
        }

    position_name = _localized_name(position, locale)
    blueprint = _blueprint(locale, experience_level)
    return {
        'position_public_id': position.public_id,
        'name_vi': _name_vi(position),
        'locale': locale,
        'experience_level': experience_level,
        'source': 'blueprint',
        'sample_content_public_id': None,
        'schema_version': 1,
        'content_json': _content_from_blueprint(blueprint, locale, position_name),
    }
