"""Declarative catalogue data for ``seed_cv_templates``.

Only deployed renderer keys and canonical section keys appear here: a template
version never stores a component, CSS or executable code, so the seed is pure
configuration over the contracts in ``renderers.py`` and ``section_registry.py``.
"""

LOCALES = ('vi-VN', 'en-US', 'ja-JP', 'zh-CN')

SINGLE_COLUMN = 'classic_single_column_v1'
TWO_COLUMN = 'classic_two_column_v1'
HEADER_TWO_COLUMN = 'header_two_column_v1'

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

# Canonical section keys ordered per region, per renderer. ``nameplate`` and
# ``contact`` stay unmapped outside the header renderer: those layouts draw
# personal info from their own header block, so mapping the markers as well
# would print the candidate's name twice.
SECTION_PLANS = {
    SINGLE_COLUMN: {
        'main': (
            'avatar',
            'summary',
            'experience',
            'education',
            'skills',
            'projects',
            'certifications',
            'languages',
            'awards',
            'activities',
            'interests',
            'references',
            'custom',
        ),
    },
    TWO_COLUMN: {
        'main': (
            'summary',
            'experience',
            'education',
            'projects',
            'activities',
            'awards',
            'references',
            'custom',
        ),
        'sidebar': ('avatar', 'skills', 'certifications', 'languages', 'interests'),
    },
    HEADER_TWO_COLUMN: {
        'header': ('avatar', 'nameplate', 'contact'),
        'main': (
            'summary',
            'experience',
            'education',
            'projects',
            'activities',
            'awards',
            'references',
            'custom',
        ),
        'sidebar': ('skills', 'certifications', 'languages', 'interests'),
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
        'renderer_key': SINGLE_COLUMN,
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
            'ja-JP': 'エレガント',
            'zh-CN': '优雅',
        },
        'descriptions': {
            'vi-VN': 'Mẫu một cột cân đối, chữ rõ ràng, phù hợp với hầu hết vị trí ứng tuyển và đọc tốt trên hệ thống lọc hồ sơ tự động.',
            'en-US': 'A balanced single-column layout with clear typography that suits most roles and reads well in applicant tracking systems.',
            'ja-JP': 'バランスの取れた1カラムレイアウト。読みやすい書体で、多くの職種と採用管理システムに適しています。',
            'zh-CN': '均衡的单栏排版，字体清晰，适合多数岗位，也便于简历筛选系统识别。',
        },
    },
    {
        'slug': 'chuyen-nghiep',
        'renderer_key': TWO_COLUMN,
        'sidebar_percent': 35,
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
            'ja-JP': 'プロフェッショナル',
            'zh-CN': '专业',
        },
        'descriptions': {
            'vi-VN': 'Bố cục hai cột chuẩn mực: cột chính dành cho kinh nghiệm, cột phụ gom kỹ năng, chứng chỉ và ngôn ngữ.',
            'en-US': 'A standard two-column layout: the main column carries your experience while the sidebar groups skills, certifications and languages.',
            'ja-JP': '標準的な2カラム構成。メイン列に職務経歴、サイド列にスキル・資格・語学をまとめます。',
            'zh-CN': '标准双栏结构：主栏呈现工作经历，侧栏集中展示技能、证书与语言能力。',
        },
    },
    {
        'slug': 'hien-dai',
        'renderer_key': HEADER_TWO_COLUMN,
        'sidebar_percent': 35,
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
            'ja-JP': 'モダン',
            'zh-CN': '现代',
        },
        'descriptions': {
            'vi-VN': 'Dải đầu trang chứa ảnh, tên và thông tin liên hệ; phần thân chia hai cột giúp nhà tuyển dụng nắm thông tin trong vài giây.',
            'en-US': 'A banner header holds your photo, name and contact details, while the two-column body lets recruiters scan the essentials in seconds.',
            'ja-JP': 'ヘッダーに写真・氏名・連絡先を配置し、本文は2カラム。採用担当者が数秒で要点を把握できます。',
            'zh-CN': '页眉集中展示照片、姓名与联系方式，正文双栏排布，招聘方可在数秒内抓住重点。',
        },
    },
    {
        'slug': 'toi-gian',
        'renderer_key': SINGLE_COLUMN,
        'theme_color': '#334E68',
        'font_family': 'Source Sans Pro',
        'font_scale': 0.95,
        'line_height': 1.5,
        'margin_mm': 14,
        'is_premium': False,
        'categories': ('toi-gian', 'than-thien-ats', 'mot-cot'),
        'names': {
            'vi-VN': 'Tối Giản',
            'en-US': 'Minimal',
            'ja-JP': 'ミニマル',
            'zh-CN': '极简',
        },
        'descriptions': {
            'vi-VN': 'Lề rộng, giãn dòng thoáng và không chi tiết trang trí, dành cho hồ sơ muốn nội dung tự nói lên tất cả.',
            'en-US': 'Wide margins, generous line spacing and no decoration, for a profile that lets the content speak for itself.',
            'ja-JP': '広い余白とゆとりある行間で装飾を排し、内容そのもので勝負するプロフィール向けです。',
            'zh-CN': '宽边距、松散行距、零装饰，适合让内容本身说话的求职者。',
        },
    },
    {
        'slug': 'an-tuong',
        'renderer_key': HEADER_TWO_COLUMN,
        'sidebar_percent': 38,
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
            'ja-JP': 'インパクト',
            'zh-CN': '印象',
        },
        'descriptions': {
            'vi-VN': 'Cột phụ rộng và tông màu đậm tạo điểm nhấn thị giác, hợp với hồ sơ marketing, truyền thông và thiết kế.',
            'en-US': 'A wide sidebar and deep accent colour create a strong visual focus, suited to marketing, communications and design profiles.',
            'ja-JP': '幅広のサイド列と濃いアクセントカラーが視線を集め、マーケティング・広報・デザイン職に適します。',
            'zh-CN': '较宽侧栏与浓郁主色形成视觉焦点，适合市场、传播与设计类简历。',
        },
    },
    {
        'slug': 'nang-dong',
        'renderer_key': TWO_COLUMN,
        'sidebar_percent': 32,
        'theme_color': '#C2410C',
        'font_family': 'Calibri',
        'font_scale': 1.0,
        'line_height': 1.45,
        'margin_mm': 12,
        'is_premium': False,
        'categories': ('sang-tao', 'sinh-vien', 'hai-cot', 'co-anh-dai-dien'),
        'names': {
            'vi-VN': 'Năng Động',
            'en-US': 'Dynamic',
            'ja-JP': 'ダイナミック',
            'zh-CN': '活力',
        },
        'descriptions': {
            'vi-VN': 'Tông cam ấm và cột phụ gọn gàng, dành cho sinh viên mới ra trường muốn khoe hoạt động và dự án cá nhân.',
            'en-US': 'A warm orange accent and a compact sidebar, made for graduates who want their activities and side projects to stand out.',
            'ja-JP': '温かみのあるオレンジとコンパクトなサイド列。課外活動や個人プロジェクトを見せたい新卒者向けです。',
            'zh-CN': '暖橙主色搭配紧凑侧栏，适合希望突出社团活动与个人项目的应届毕业生。',
        },
    },
    {
        'slug': 'tin-cay',
        'renderer_key': SINGLE_COLUMN,
        'theme_color': '#1D4ED8',
        'font_family': 'Arial',
        'font_scale': 1.0,
        'line_height': 1.4,
        'margin_mm': 13,
        'is_premium': False,
        'categories': ('co-dien', 'ke-toan', 'than-thien-ats', 'mot-cot'),
        'names': {
            'vi-VN': 'Tin Cậy',
            'en-US': 'Trust',
            'ja-JP': 'トラスト',
            'zh-CN': '信赖',
        },
        'descriptions': {
            'vi-VN': 'Bố cục truyền thống với phông chữ phổ thông, an toàn cho các ngành yêu cầu sự chuẩn xác như kế toán, kiểm toán, hành chính.',
            'en-US': 'A traditional layout in a widely available typeface, a safe choice for precision-driven fields such as accounting, audit and administration.',
            'ja-JP': '汎用書体を用いた伝統的なレイアウト。会計・監査・総務など正確さを求められる分野に安心して使えます。',
            'zh-CN': '传统版式搭配通用字体，适用于会计、审计、行政等强调严谨的岗位。',
        },
    },
    {
        'slug': 'dinh-cao',
        'renderer_key': HEADER_TWO_COLUMN,
        'sidebar_percent': 30,
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
            'ja-JP': 'エグゼクティブ',
            'zh-CN': '卓越',
        },
        'descriptions': {
            'vi-VN': 'Cỡ chữ lớn hơn và cột chính rộng, dành cho hồ sơ quản lý cần kể lại thành tích theo từng giai đoạn sự nghiệp.',
            'en-US': 'Larger type and a wide main column, built for management profiles that need room to tell an achievement story stage by stage.',
            'ja-JP': '大きめの文字と広いメイン列。キャリアの各段階の実績を語る管理職向けの構成です。',
            'zh-CN': '字号更大、主栏更宽，适合需要按阶段陈述管理业绩的中高层履历。',
        },
    },
    {
        'slug': 'ky-thuat',
        'renderer_key': TWO_COLUMN,
        'sidebar_percent': 35,
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
            'ja-JP': 'テクニカル',
            'zh-CN': '技术',
        },
        'descriptions': {
            'vi-VN': 'Cột phụ ưu tiên kỹ năng công nghệ và chứng chỉ, cột chính đủ chỗ mô tả dự án — hợp với lập trình viên, kỹ sư dữ liệu, kiểm thử.',
            'en-US': 'The sidebar foregrounds technical skills and certifications while the main column leaves room for project detail — a fit for developers, data engineers and testers.',
            'ja-JP': 'サイド列に技術スキルと資格、メイン列にプロジェクト詳細。開発者・データエンジニア・テスターに適しています。',
            'zh-CN': '侧栏突出技术栈与证书，主栏留足项目描述空间，适合开发、数据与测试岗位。',
        },
    },
    {
        'slug': 'tinh-gon',
        'renderer_key': SINGLE_COLUMN,
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
            'ja-JP': 'コンパクト',
            'zh-CN': '精简',
        },
        'descriptions': {
            'vi-VN': 'Cỡ chữ và giãn dòng nhỏ hơn để dồn nhiều kinh nghiệm vào một trang, hữu ích khi hồ sơ đã dài quá hai trang.',
            'en-US': 'Smaller type and tighter spacing fit more experience on a single page, useful once a profile runs past two pages.',
            'ja-JP': '文字と行間を詰めて1ページに多くの経歴を収められます。2ページを超えた履歴書に有効です。',
            'zh-CN': '更小字号与更紧行距，可在一页内容纳更多经历，适合内容已超过两页的简历。',
        },
    },
)


def layout_regions(renderer_key, sidebar_percent=35):
    """Region geometry for a renderer; widths always total 100 per row."""
    if renderer_key == SINGLE_COLUMN:
        return [{'id': 'main', 'row': 0, 'width_percent': 100, 'section_instance_ids': []}]
    main_percent = 100 - sidebar_percent
    if renderer_key == TWO_COLUMN:
        return [
            {'id': 'main', 'row': 0, 'width_percent': main_percent, 'section_instance_ids': []},
            {
                'id': 'sidebar',
                'row': 0,
                'width_percent': sidebar_percent,
                'section_instance_ids': [],
            },
        ]
    return [
        {'id': 'header', 'row': 0, 'width_percent': 100, 'section_instance_ids': []},
        {'id': 'main', 'row': 1, 'width_percent': main_percent, 'section_instance_ids': []},
        {'id': 'sidebar', 'row': 1, 'width_percent': sidebar_percent, 'section_instance_ids': []},
    ]


def layout_capabilities(renderer_key, regions):
    """Presentation limits the canonical writers enforce for every client.

    ``column_resize`` must stay disabled on a single-column renderer: the
    validator in ``apps.cvs.schemas`` rejects a resizable template that has no
    row with two regions to redistribute width between.
    """
    resize = (
        {'enabled': False}
        if renderer_key == SINGLE_COLUMN
        else {'enabled': True, 'min_percent': 25, 'max_percent': 75}
    )
    return {
        'layout': {
            'section_drag': True,
            'cross_region_drag': renderer_key != SINGLE_COLUMN,
            'item_drag': True,
            'column_resize': resize,
        },
        'supports_regions': [region['id'] for region in regions],
    }
