"""Public model API for the cv_templates Django app."""

from .content_schema import (
    empty_content,
    empty_layout,
    empty_style,
    validate_cv_document,
    validate_template_layout_capabilities,
)
from .content_text import CV_FONT_FAMILIES, HEX_COLOR_RE
from .experience import DEFAULT_EXPERIENCE_BAND, EXPERIENCE_BAND_ORDER, ExperienceBand
from .language import (
    CATALOG_LANGUAGES,
    DEFAULT_CV_LANGUAGE,
    CatalogLanguage,
    CvLanguage,
    catalog_language,
    catalog_language_for_path,
    localized_field,
)
from .position import CvPositionField, CvPositionProfile
from .sample_content import CvSampleContent, CvSampleGeneration
from .template import CvCategory, CvColor, CvTemplate, CvTemplateCategoryLink, CvTemplateColorLink
from .template_version import CvSectionDefinition, CvTemplateSection, CvTemplateVersion

__all__ = [
    'CV_FONT_FAMILIES',
    'HEX_COLOR_RE',
    'empty_content',
    'empty_layout',
    'empty_style',
    'validate_cv_document',
    'validate_template_layout_capabilities',
    'CATALOG_LANGUAGES',
    'DEFAULT_CV_LANGUAGE',
    'DEFAULT_EXPERIENCE_BAND',
    'EXPERIENCE_BAND_ORDER',
    'ExperienceBand',
    'CatalogLanguage',
    'CvLanguage',
    'catalog_language',
    'catalog_language_for_path',
    'localized_field',
    'CvCategory',
    'CvColor',
    'CvPositionField',
    'CvPositionProfile',
    'CvSampleContent',
    'CvSampleGeneration',
    'CvSectionDefinition',
    'CvTemplate',
    'CvTemplateCategoryLink',
    'CvTemplateColorLink',
    'CvTemplateSection',
    'CvTemplateVersion',
]
