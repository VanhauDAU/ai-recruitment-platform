"""Declarative catalogue data for ``seed_cv_templates``.

Only deployed layout keys (``layouts.json``) and canonical section keys appear
here: a template version never stores a component, CSS or executable code, so the
seed is pure configuration over ``renderers.py`` and ``section_registry.py``.
"""

from apps.cv_templates.renderers import get_renderer_contract

# Palette shared by every template. The first five entries intentionally match
# ``seed_cv_catalog.DEFAULT_COLORS`` so both commands converge on one row set.
PALETTE = (
    ('Xanh thương hiệu', 'brand-green', '#00A66A'),
    ('Than chì', 'charcoal', '#1F2937'),
    ('Xanh đá', 'slate-blue', '#334E68'),
    ('Đỏ rượu', 'burgundy', '#5B2333'),
    ('Xanh teal', 'teal', '#0E7490'),
    ('Xanh hoàng gia', 'royal-blue', '#1D4ED8'),
    ('Tím than', 'indigo', '#4338CA'),
    ('Cam đất', 'terracotta', '#C2410C'),
)

# (category_type, slug, name, description, sort_order)
CATEGORIES = (
    ('style', 'don-gian', 'Đơn giản', 'Bố cục sáng sủa, dễ đọc cho mọi ngành nghề.', 0),
    ('style', 'hien-dai', 'Hiện đại', 'Khối màu và khoảng trắng theo phong cách mới.', 1),
    ('style', 'chuyen-nghiep', 'Chuyên nghiệp', 'Chuẩn mực, phù hợp môi trường doanh nghiệp.', 2),
    ('style', 'sang-tao', 'Sáng tạo', 'Nhấn màu mạnh cho ngành thiết kế, truyền thông.', 3),
    ('style', 'toi-gian', 'Tối giản', 'Chỉ giữ thông tin cốt lõi, không trang trí.', 4),
    ('style', 'co-dien', 'Cổ điển', 'Bố cục truyền thống, an toàn với mọi nhà tuyển dụng.', 5),
    (
        'audience',
        'sinh-vien',
        'Sinh viên & thực tập sinh',
        'Ưu tiên học vấn, hoạt động và dự án.',
        0,
    ),
    (
        'audience',
        'co-kinh-nghiem',
        'Có kinh nghiệm',
        'Dành nhiều diện tích cho kinh nghiệm làm việc.',
        1,
    ),
    ('audience', 'quan-ly', 'Quản lý & điều hành', 'Làm nổi bật thành tích và phạm vi quản lý.', 2),
    (
        'position',
        'cong-nghe-thong-tin',
        'Công nghệ thông tin',
        'Có sẵn khu vực cho dự án và kỹ năng công nghệ.',
        0,
    ),
    ('position', 'marketing', 'Marketing', 'Phù hợp hồ sơ truyền thông, nội dung, quảng cáo.', 1),
    (
        'position',
        'kinh-doanh',
        'Kinh doanh',
        'Nhấn vào chỉ tiêu doanh số và thành tích bán hàng.',
        2,
    ),
    ('position', 'ke-toan', 'Kế toán', 'Trình bày chặt chẽ, dễ đối chiếu chứng chỉ.', 3),
    ('position', 'nhan-su', 'Nhân sự', 'Cân bằng giữa kỹ năng mềm và kinh nghiệm.', 4),
    (
        'feature',
        'than-thien-ats',
        'Thân thiện ATS',
        'Một cột, không bảng biểu, máy quét CV đọc được.',
        0,
    ),
    ('feature', 'mot-cot', '1 cột', 'Toàn bộ nội dung chạy dọc một cột.', 1),
    ('feature', 'hai-cot', '2 cột', 'Cột phụ dành cho kỹ năng, chứng chỉ, ngôn ngữ.', 2),
    ('feature', 'co-anh-dai-dien', 'Có ảnh đại diện', 'Có sẵn vị trí đặt ảnh chân dung.', 3),
    (
        'feature',
        'header-noi-bat',
        'Header nổi bật',
        'Dải đầu trang chứa tên và thông tin liên hệ.',
        4,
    ),
)

# Canonical section keys ordered per region, per layout. Every layout places
# ``nameplate`` and ``contact`` in a region (there is no hard-coded header), and
# layouts that support a photo also place ``avatar``.
_MAIN_STORY = ('summary', 'experience', 'education', 'projects', 'activities', 'awards')
_SIDE_FACTS = ('skills', 'certifications', 'languages', 'interests')
_TAIL = ('references', 'custom')

SECTION_PLANS = {
    'single_column_v1': {
        'main': (
            'nameplate',
            'contact',
            *_MAIN_STORY[:3],
            'skills',
            *_MAIN_STORY[3:],
            'certifications',
            'languages',
            'interests',
            *_TAIL,
        ),
    },
    'single_column_photo_v1': {
        'header': ('avatar', 'nameplate', 'contact'),
        'main': (
            *_MAIN_STORY[:3],
            'skills',
            *_MAIN_STORY[3:],
            'certifications',
            'languages',
            'interests',
            *_TAIL,
        ),
    },
    'sidebar_left_v1': {
        'sidebar': ('nameplate', 'contact', *_SIDE_FACTS),
        'main': (*_MAIN_STORY, *_TAIL),
    },
    'sidebar_left_photo_v1': {
        'sidebar': ('avatar', 'nameplate', 'contact', *_SIDE_FACTS),
        'main': (*_MAIN_STORY, *_TAIL),
    },
    'sidebar_right_v1': {
        'main': ('nameplate', 'contact', *_MAIN_STORY, *_TAIL),
        'sidebar': ('avatar', *_SIDE_FACTS),
    },
    'header_band_two_column_v1': {
        'header': ('avatar', 'nameplate', 'contact'),
        'main': (*_MAIN_STORY, *_TAIL),
        'sidebar': _SIDE_FACTS,
    },
    'timeline_v1': {
        'header': ('avatar', 'nameplate', 'contact'),
        'main': (
            *_MAIN_STORY[:3],
            'skills',
            *_MAIN_STORY[3:],
            'certifications',
            'languages',
            'interests',
            *_TAIL,
        ),
    },
    'compact_two_column_v1': {
        'header': ('nameplate', 'contact'),
        'left': ('summary', 'experience', 'projects', 'activities', *_TAIL),
        'right': ('education', 'skills', 'certifications', 'languages', 'awards', 'interests'),
    },
}

REQUIRED_SECTIONS = frozenset({'experience', 'education', 'skills', 'nameplate', 'contact'})
DEFAULT_ENABLED_SECTIONS = frozenset(
    {'summary', 'experience', 'education', 'skills', 'nameplate', 'contact'}
)
# Personal-info backed markers render values, never a section heading.
PERSONAL_INFO_SECTIONS = frozenset({'avatar', 'nameplate', 'contact'})

TEMPLATES = (
    {
        'slug': 'thanh-lich',
        'renderer_key': 'single_column_v1',
        'theme_color': '#00A66A',
        'font_family': 'Roboto',
        'font_scale': 1.0,
        'line_height': 1.45,
        'margin_mm': 12,
        'is_premium': False,
        'categories': ('don-gian', 'sinh-vien', 'than-thien-ats', 'mot-cot'),
        'names': {
            'vi-VN': 'Thanh Lịch',
            'en-US': 'Elegant',
        },
        'descriptions': {
            'vi-VN': 'Mẫu một cột cân đối, chữ rõ ràng, phù hợp với hầu hết vị trí ứng tuyển và đọc tốt trên hệ thống lọc hồ sơ tự động.',
            'en-US': 'A balanced single-column layout with clear typography that suits most roles and reads well in applicant tracking systems.',
        },
    },
    {
        'slug': 'chuyen-nghiep',
        'renderer_key': 'sidebar_right_v1',
        'side_percent': 35,
        'theme_color': '#1F2937',
        'font_family': 'Inter',
        'font_scale': 1.0,
        'line_height': 1.4,
        'margin_mm': 12,
        'is_premium': False,
        'categories': ('chuyen-nghiep', 'co-kinh-nghiem', 'hai-cot', 'co-anh-dai-dien'),
        'names': {
            'vi-VN': 'Chuyên Nghiệp',
            'en-US': 'Professional',
        },
        'descriptions': {
            'vi-VN': 'Bố cục hai cột chuẩn mực: cột chính dành cho kinh nghiệm, cột phụ gom kỹ năng, chứng chỉ và ngôn ngữ.',
            'en-US': 'A standard two-column layout: the main column carries your experience while the sidebar groups skills, certifications and languages.',
        },
    },
    {
        'slug': 'hien-dai',
        'renderer_key': 'header_band_two_column_v1',
        'side_percent': 35,
        'theme_color': '#0E7490',
        'font_family': 'Inter',
        'font_scale': 1.0,
        'line_height': 1.45,
        'margin_mm': 10,
        'is_premium': False,
        'categories': ('hien-dai', 'co-kinh-nghiem', 'header-noi-bat', 'co-anh-dai-dien'),
        'names': {
            'vi-VN': 'Hiện Đại',
            'en-US': 'Modern',
        },
        'descriptions': {
            'vi-VN': 'Dải đầu trang chứa ảnh, tên và thông tin liên hệ; phần thân chia hai cột giúp nhà tuyển dụng nắm thông tin trong vài giây.',
            'en-US': 'A banner header holds your photo, name and contact details, while the two-column body lets recruiters scan the essentials in seconds.',
        },
    },
    {
        'slug': 'toi-gian',
        'renderer_key': 'single_column_v1',
        'theme_color': '#334E68',
        'font_family': 'Be Vietnam Pro',
        'font_scale': 0.95,
        'line_height': 1.5,
        'margin_mm': 14,
        'is_premium': False,
        'categories': ('toi-gian', 'than-thien-ats', 'mot-cot'),
        'names': {
            'vi-VN': 'Tối Giản',
            'en-US': 'Minimal',
        },
        'descriptions': {
            'vi-VN': 'Lề rộng, giãn dòng thoáng và không chi tiết trang trí, dành cho hồ sơ muốn nội dung tự nói lên tất cả.',
            'en-US': 'Wide margins, generous line spacing and no decoration, for a profile that lets the content speak for itself.',
        },
    },
    {
        'slug': 'an-tuong',
        'renderer_key': 'sidebar_left_photo_v1',
        'side_percent': 38,
        'theme_color': '#5B2333',
        'font_family': 'Roboto',
        'font_scale': 1.0,
        'line_height': 1.4,
        'margin_mm': 10,
        'is_premium': True,
        'categories': ('sang-tao', 'marketing', 'header-noi-bat', 'co-anh-dai-dien'),
        'names': {
            'vi-VN': 'Ấn Tượng',
            'en-US': 'Impact',
        },
        'descriptions': {
            'vi-VN': 'Cột phụ rộng và tông màu đậm tạo điểm nhấn thị giác, hợp với hồ sơ marketing, truyền thông và thiết kế.',
            'en-US': 'A wide sidebar and deep accent colour create a strong visual focus, suited to marketing, communications and design profiles.',
        },
    },
    {
        'slug': 'nang-dong',
        'renderer_key': 'sidebar_left_v1',
        'side_percent': 32,
        'theme_color': '#C2410C',
        'font_family': 'Be Vietnam Pro',
        'font_scale': 1.0,
        'line_height': 1.45,
        'margin_mm': 12,
        'is_premium': False,
        'categories': ('sang-tao', 'sinh-vien', 'hai-cot', 'co-anh-dai-dien'),
        'names': {
            'vi-VN': 'Năng Động',
            'en-US': 'Dynamic',
        },
        'descriptions': {
            'vi-VN': 'Tông cam ấm và cột phụ gọn gàng, dành cho sinh viên mới ra trường muốn khoe hoạt động và dự án cá nhân.',
            'en-US': 'A warm orange accent and a compact sidebar, made for graduates who want their activities and side projects to stand out.',
        },
    },
    {
        'slug': 'tin-cay',
        'renderer_key': 'single_column_photo_v1',
        'theme_color': '#1D4ED8',
        'font_family': 'Lora',
        'font_scale': 1.0,
        'line_height': 1.4,
        'margin_mm': 13,
        'is_premium': False,
        'categories': ('co-dien', 'ke-toan', 'than-thien-ats', 'mot-cot'),
        'names': {
            'vi-VN': 'Tin Cậy',
            'en-US': 'Trust',
        },
        'descriptions': {
            'vi-VN': 'Bố cục truyền thống với phông chữ phổ thông, an toàn cho các ngành yêu cầu sự chuẩn xác như kế toán, kiểm toán, hành chính.',
            'en-US': 'A traditional layout in a widely available typeface, a safe choice for precision-driven fields such as accounting, audit and administration.',
        },
    },
    {
        'slug': 'dinh-cao',
        'renderer_key': 'timeline_v1',
        'theme_color': '#4338CA',
        'font_family': 'Inter',
        'font_scale': 1.05,
        'line_height': 1.4,
        'margin_mm': 11,
        'is_premium': True,
        'categories': ('chuyen-nghiep', 'quan-ly', 'header-noi-bat', 'hai-cot'),
        'names': {
            'vi-VN': 'Đỉnh Cao',
            'en-US': 'Executive',
        },
        'descriptions': {
            'vi-VN': 'Cỡ chữ lớn hơn và cột chính rộng, dành cho hồ sơ quản lý cần kể lại thành tích theo từng giai đoạn sự nghiệp.',
            'en-US': 'Larger type and a wide main column, built for management profiles that need room to tell an achievement story stage by stage.',
        },
    },
    {
        'slug': 'ky-thuat',
        'renderer_key': 'sidebar_right_v1',
        'side_percent': 35,
        'theme_color': '#0E7490',
        'font_family': 'Roboto',
        'font_scale': 0.95,
        'line_height': 1.4,
        'margin_mm': 11,
        'is_premium': False,
        'categories': ('hien-dai', 'cong-nghe-thong-tin', 'hai-cot', 'co-kinh-nghiem'),
        'names': {
            'vi-VN': 'Kỹ Thuật',
            'en-US': 'Technical',
        },
        'descriptions': {
            'vi-VN': 'Cột phụ ưu tiên kỹ năng công nghệ và chứng chỉ, cột chính đủ chỗ mô tả dự án — hợp với lập trình viên, kỹ sư dữ liệu, kiểm thử.',
            'en-US': 'The sidebar foregrounds technical skills and certifications while the main column leaves room for project detail — a fit for developers, data engineers and testers.',
        },
    },
    {
        'slug': 'tinh-gon',
        'renderer_key': 'compact_two_column_v1',
        'theme_color': '#4338CA',
        'font_family': 'Inter',
        'font_scale': 0.9,
        'line_height': 1.35,
        'margin_mm': 10,
        'is_premium': False,
        'categories': ('don-gian', 'kinh-doanh', 'than-thien-ats', 'mot-cot'),
        'names': {
            'vi-VN': 'Tinh Gọn',
            'en-US': 'Compact',
        },
        'descriptions': {
            'vi-VN': 'Cỡ chữ và giãn dòng nhỏ hơn để dồn nhiều kinh nghiệm vào một trang, hữu ích khi hồ sơ đã dài quá hai trang.',
            'en-US': 'Smaller type and tighter spacing fit more experience on a single page, useful once a profile runs past two pages.',
        },
    },
)


def layout_regions(layout_key, side_percent=None):
    """Region geometry of a layout; ``side_percent`` narrows/widens the secondary
    column of a two-column row (widths always total 100 per row)."""
    regions = get_renderer_contract(layout_key).default_regions()
    rows = {}
    for region in regions:
        rows.setdefault(region['row'], []).append(region)
    for row in rows.values():
        if side_percent and len(row) == 2:
            primary, secondary = sorted(row, key=lambda region: -region['width_percent'])
            secondary['width_percent'] = side_percent
            primary['width_percent'] = 100 - side_percent
    return regions


def layout_capabilities(layout_key):
    return get_renderer_contract(layout_key).capabilities()
