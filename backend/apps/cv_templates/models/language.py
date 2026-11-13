"""Ngôn ngữ nội dung CV (CVT-1a).

Enum cố định thay cho bảng `sitecontent.Locale`: sản phẩm chỉ hỗ trợ tiếng Việt
và tiếng Anh, nên ngôn ngữ là hằng của code chứ không phải dữ liệu admin. Giá
trị dùng mã BCP 47 vì `content_json.locale`, API và frontend đều dùng mã này.
"""

from dataclasses import dataclass

from django.db import models


class CvLanguage(models.TextChoices):
    VI = 'vi-VN', 'Tiếng Việt'
    EN = 'en-US', 'Tiếng Anh'


DEFAULT_CV_LANGUAGE = CvLanguage.VI


@dataclass(frozen=True)
class CatalogLanguage:
    """Thông tin hiển thị của một ngôn ngữ trên kho mẫu công khai."""

    code: str
    path: str
    label: str  # Dạng viết thường giữa câu: "Mẫu CV tiếng Việt".
    field_suffix: str  # Hậu tố trường song ngữ trên CvTemplate.


CATALOG_LANGUAGES = (
    CatalogLanguage(CvLanguage.VI, 'mau-cv', 'tiếng Việt', 'vi'),
    CatalogLanguage(CvLanguage.EN, 'mau-cv-tieng-anh', 'tiếng Anh', 'en'),
)
_BY_CODE = {item.code: item for item in CATALOG_LANGUAGES}
_BY_PATH = {item.path: item for item in CATALOG_LANGUAGES}


def catalog_language(code):
    """Trả về `CatalogLanguage` của mã ngôn ngữ, hoặc `None` nếu không hỗ trợ."""
    return _BY_CODE.get(code)


def catalog_language_for_path(path):
    return _BY_PATH.get(path)


def localized_field(field, language):
    """Tên trường song ngữ, ví dụ `localized_field('display_name', 'en-US')`."""
    return f'{field}_{_BY_CODE[language].field_suffix}'
