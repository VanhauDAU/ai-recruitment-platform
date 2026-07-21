from django.core.management.base import BaseCommand

from apps.jobs.models import JobCategory, JobCategoryLocalization

# 3-level taxonomy: nhóm nghề -> nghề -> vị trí chuyên môn
SEED_CATEGORIES = {
    'Kinh doanh/Bán hàng': {
        'Sales Xuất nhập khẩu/Logistics': ['Sales Logistics', 'Sales Xuất nhập khẩu khác'],
        'Sales Bất động sản': ['Môi giới bất động sản', 'Sales Bất động sản khác'],
        'Sales Xây dựng': [
            'Kinh doanh thiết bị/vật liệu xây dựng',
            'Kinh doanh nội thất',
            'Tư vấn thiết kế xây dựng',
        ],
        'Sales Giáo dục/Khoá học': ['Tư vấn tuyển sinh/khoá học', 'Tư vấn du học/định cư'],
        'Nhân viên kinh doanh': ['Telesales', 'Sales Admin', 'Sales Online'],
    },
    'Marketing/PR/Quảng cáo': {
        'Digital Marketing': ['SEO/SEM', 'Quảng cáo Facebook/Google'],
        'Content': ['Content Marketing', 'Copywriter'],
        'PR/Truyền thông': ['Quan hệ công chúng', 'Tổ chức sự kiện'],
    },
    'Chăm sóc khách hàng': {
        'CSKH/Vận hành': ['Nhân viên CSKH', 'Tổng đài viên', 'Trực page'],
    },
    'Nhân sự/Hành chính/Pháp chế': {
        'Nhân sự': ['Tuyển dụng', 'C&B', 'Đào tạo'],
        'Hành chính': ['Hành chính văn phòng', 'Lễ tân', 'Thư ký/Trợ lý'],
        'Pháp chế': ['Pháp chế doanh nghiệp', 'Luật sư'],
    },
    'Công nghệ thông tin': {
        'Lập trình Web': ['Frontend Developer', 'Backend Developer', 'Fullstack Developer'],
        'Lập trình Mobile': ['Android Developer', 'iOS Developer', 'React Native/Flutter'],
        'Data/AI': ['Data Analyst', 'Data Engineer', 'AI/Machine Learning Engineer'],
        'DevOps/System': ['DevOps Engineer', 'System Admin', 'Cloud Engineer'],
        'Kiểm thử/QA': ['Manual Tester', 'Automation Tester'],
        'IT Support': ['IT Helpdesk', 'IT phần cứng/mạng'],
    },
    'Kế toán/Kiểm toán/Thuế': {
        'Kế toán': ['Kế toán tổng hợp', 'Kế toán nội bộ', 'Kế toán công nợ'],
        'Kiểm toán/Thuế': ['Kiểm toán nội bộ', 'Chuyên viên thuế'],
    },
    'Thiết kế/Sáng tạo': {
        'Thiết kế': ['UI/UX Designer', 'Graphic Designer', 'Thiết kế nội thất'],
        'Media': ['Video Editor', 'Photographer'],
    },
    'Lao động phổ thông': {
        'Sản xuất/Kho vận': ['Công nhân sản xuất', 'Nhân viên kho', 'Đóng gói'],
        'Dịch vụ': ['Lái xe/Giao hàng', 'Bảo vệ', 'Tạp vụ'],
    },
}

# Baseline editorial data for the four CV preview languages. Production
# changes are managed in Django admin; get_or_create below never overwrites an
# administrator's reviewed wording.
POSITION_LOCALIZATIONS = {
    'AI/Machine Learning Engineer': {
        'en-US': 'AI/Machine Learning Engineer',
        'ja-JP': 'AI・機械学習エンジニア',
        'zh-CN': '人工智能/机器学习工程师',
    },
    'Android Developer': {
        'en-US': 'Android Developer',
        'ja-JP': 'Android開発者',
        'zh-CN': 'Android开发工程师',
    },
    'Automation Tester': {
        'en-US': 'Automation Tester',
        'ja-JP': '自動化テスター',
        'zh-CN': '自动化测试工程师',
    },
    'Backend Developer': {
        'en-US': 'Backend Developer',
        'ja-JP': 'バックエンド開発者',
        'zh-CN': '后端开发工程师',
    },
    'Bảo vệ': {'en-US': 'Security Guard', 'ja-JP': '警備員', 'zh-CN': '保安员'},
    'C&B': {
        'en-US': 'Compensation & Benefits Specialist',
        'ja-JP': 'C&B担当者',
        'zh-CN': '薪酬福利专员',
    },
    'Chuyên viên thuế': {
        'en-US': 'Tax Specialist',
        'ja-JP': '税務スペシャリスト',
        'zh-CN': '税务专员',
    },
    'Cloud Engineer': {
        'en-US': 'Cloud Engineer',
        'ja-JP': 'クラウドエンジニア',
        'zh-CN': '云计算工程师',
    },
    'Công nhân sản xuất': {
        'en-US': 'Production Worker',
        'ja-JP': '製造作業員',
        'zh-CN': '生产工人',
    },
    'Content Marketing': {
        'en-US': 'Content Marketing Specialist',
        'ja-JP': 'コンテンツマーケティング担当',
        'zh-CN': '内容营销专员',
    },
    'Copywriter': {'en-US': 'Copywriter', 'ja-JP': 'コピーライター', 'zh-CN': '文案策划'},
    'Đào tạo': {'en-US': 'Training Specialist', 'ja-JP': '研修担当者', 'zh-CN': '培训专员'},
    'Data Analyst': {'en-US': 'Data Analyst', 'ja-JP': 'データアナリスト', 'zh-CN': '数据分析师'},
    'Data Engineer': {'en-US': 'Data Engineer', 'ja-JP': 'データエンジニア', 'zh-CN': '数据工程师'},
    'DevOps Engineer': {
        'en-US': 'DevOps Engineer',
        'ja-JP': 'DevOpsエンジニア',
        'zh-CN': 'DevOps工程师',
    },
    'Đóng gói': {'en-US': 'Packing Worker', 'ja-JP': '梱包作業員', 'zh-CN': '包装工'},
    'Frontend Developer': {
        'en-US': 'Frontend Developer',
        'ja-JP': 'フロントエンド開発者',
        'zh-CN': '前端开发工程师',
    },
    'Fullstack Developer': {
        'en-US': 'Fullstack Developer',
        'ja-JP': 'フルスタック開発者',
        'zh-CN': '全栈开发工程师',
    },
    'Graphic Designer': {
        'en-US': 'Graphic Designer',
        'ja-JP': 'グラフィックデザイナー',
        'zh-CN': '平面设计师',
    },
    'Hành chính văn phòng': {
        'en-US': 'Office Administrator',
        'ja-JP': 'オフィス管理スタッフ',
        'zh-CN': '行政文员',
    },
    'iOS Developer': {'en-US': 'iOS Developer', 'ja-JP': 'iOS開発者', 'zh-CN': 'iOS开发工程师'},
    'IT Helpdesk': {
        'en-US': 'IT Helpdesk Specialist',
        'ja-JP': 'ITヘルプデスク担当',
        'zh-CN': 'IT服务台专员',
    },
    'IT phần cứng/mạng': {
        'en-US': 'IT Hardware/Network Specialist',
        'ja-JP': 'ITハードウェア・ネットワーク担当',
        'zh-CN': 'IT硬件与网络专员',
    },
    'Kế toán công nợ': {
        'en-US': 'Accounts Receivable/Payable Accountant',
        'ja-JP': '債権債務会計担当',
        'zh-CN': '往来会计',
    },
    'Kế toán nội bộ': {
        'en-US': 'Internal Accountant',
        'ja-JP': '社内会計担当',
        'zh-CN': '内部会计',
    },
    'Kế toán tổng hợp': {
        'en-US': 'General Accountant',
        'ja-JP': '総合会計担当',
        'zh-CN': '总账会计',
    },
    'Kiểm toán nội bộ': {
        'en-US': 'Internal Auditor',
        'ja-JP': '内部監査担当',
        'zh-CN': '内部审计师',
    },
    'Kinh doanh nội thất': {
        'en-US': 'Interior Sales Specialist',
        'ja-JP': 'インテリア営業担当',
        'zh-CN': '家居销售专员',
    },
    'Kinh doanh thiết bị/vật liệu xây dựng': {
        'en-US': 'Construction Equipment/Materials Sales',
        'ja-JP': '建設設備・資材営業',
        'zh-CN': '建筑设备/材料销售',
    },
    'Lái xe/Giao hàng': {
        'en-US': 'Driver/Delivery Staff',
        'ja-JP': 'ドライバー・配送スタッフ',
        'zh-CN': '司机/配送员',
    },
    'Lễ tân': {'en-US': 'Receptionist', 'ja-JP': '受付スタッフ', 'zh-CN': '前台接待'},
    'Luật sư': {'en-US': 'Lawyer', 'ja-JP': '弁護士', 'zh-CN': '律师'},
    'Manual Tester': {'en-US': 'Manual Tester', 'ja-JP': '手動テスター', 'zh-CN': '手工测试工程师'},
    'Môi giới bất động sản': {
        'en-US': 'Real Estate Broker',
        'ja-JP': '不動産仲介担当',
        'zh-CN': '房地产经纪人',
    },
    'Nhân viên CSKH': {
        'en-US': 'Customer Service Representative',
        'ja-JP': 'カスタマーサポート担当',
        'zh-CN': '客户服务专员',
    },
    'Nhân viên kho': {'en-US': 'Warehouse Staff', 'ja-JP': '倉庫スタッフ', 'zh-CN': '仓库管理员'},
    'Pháp chế doanh nghiệp': {
        'en-US': 'Corporate Legal Specialist',
        'ja-JP': '企業法務担当',
        'zh-CN': '企业法务专员',
    },
    'Photographer': {'en-US': 'Photographer', 'ja-JP': 'フォトグラファー', 'zh-CN': '摄影师'},
    'Quan hệ công chúng': {
        'en-US': 'Public Relations Specialist',
        'ja-JP': '広報担当',
        'zh-CN': '公共关系专员',
    },
    'Quảng cáo Facebook/Google': {
        'en-US': 'Facebook/Google Ads Specialist',
        'ja-JP': 'Facebook・Google広告運用担当',
        'zh-CN': 'Facebook/Google广告投放专员',
    },
    'React Native/Flutter': {
        'en-US': 'React Native/Flutter Developer',
        'ja-JP': 'React Native・Flutter開発者',
        'zh-CN': 'React Native/Flutter开发工程师',
    },
    'Sales Admin': {'en-US': 'Sales Administrator', 'ja-JP': '営業事務', 'zh-CN': '销售行政专员'},
    'Sales Bất động sản khác': {
        'en-US': 'Other Real Estate Sales',
        'ja-JP': 'その他不動産営業',
        'zh-CN': '其他房地产销售',
    },
    'Sales Logistics': {
        'en-US': 'Logistics Sales Specialist',
        'ja-JP': '物流営業担当',
        'zh-CN': '物流销售专员',
    },
    'Sales Online': {
        'en-US': 'Online Sales Specialist',
        'ja-JP': 'オンライン営業担当',
        'zh-CN': '在线销售专员',
    },
    'Sales Xuất nhập khẩu khác': {
        'en-US': 'Other Import-Export Sales',
        'ja-JP': 'その他輸出入営業',
        'zh-CN': '其他进出口销售',
    },
    'SEO/SEM': {'en-US': 'SEO/SEM Specialist', 'ja-JP': 'SEO・SEM担当', 'zh-CN': 'SEO/SEM专员'},
    'System Admin': {
        'en-US': 'System Administrator',
        'ja-JP': 'システム管理者',
        'zh-CN': '系统管理员',
    },
    'Tạp vụ': {'en-US': 'Cleaner', 'ja-JP': '清掃スタッフ', 'zh-CN': '保洁员'},
    'Telesales': {
        'en-US': 'Telesales Representative',
        'ja-JP': 'テレセールス担当',
        'zh-CN': '电话销售专员',
    },
    'Thiết kế nội thất': {
        'en-US': 'Interior Designer',
        'ja-JP': 'インテリアデザイナー',
        'zh-CN': '室内设计师',
    },
    'Thư ký/Trợ lý': {
        'en-US': 'Secretary/Assistant',
        'ja-JP': '秘書・アシスタント',
        'zh-CN': '秘书/助理',
    },
    'Tổ chức sự kiện': {
        'en-US': 'Event Coordinator',
        'ja-JP': 'イベント運営担当',
        'zh-CN': '活动策划专员',
    },
    'Tổng đài viên': {
        'en-US': 'Call Center Agent',
        'ja-JP': 'コールセンター担当',
        'zh-CN': '呼叫中心专员',
    },
    'Trực page': {
        'en-US': 'Social Media Page Operator',
        'ja-JP': 'SNSページ運用担当',
        'zh-CN': '社交媒体客服专员',
    },
    'Tư vấn du học/định cư': {
        'en-US': 'Study Abroad/Immigration Consultant',
        'ja-JP': '留学・移住コンサルタント',
        'zh-CN': '留学/移民顾问',
    },
    'Tư vấn thiết kế xây dựng': {
        'en-US': 'Construction Design Consultant',
        'ja-JP': '建築設計コンサルタント',
        'zh-CN': '建筑设计顾问',
    },
    'Tư vấn tuyển sinh/khoá học': {
        'en-US': 'Admissions/Course Consultant',
        'ja-JP': '入学・講座コンサルタント',
        'zh-CN': '招生/课程顾问',
    },
    'Tuyển dụng': {'en-US': 'Recruitment Specialist', 'ja-JP': '採用担当者', 'zh-CN': '招聘专员'},
    'UI/UX Designer': {
        'en-US': 'UI/UX Designer',
        'ja-JP': 'UI・UXデザイナー',
        'zh-CN': 'UI/UX设计师',
    },
    'Video Editor': {'en-US': 'Video Editor', 'ja-JP': '動画編集者', 'zh-CN': '视频编辑'},
}


class Command(BaseCommand):
    help = 'Seed job_categories with a 3-level taxonomy (nhóm nghề -> nghề -> vị trí chuyên môn).'

    def handle(self, *args, **options):
        count = 0
        seen = []
        for group_name, jobs in SEED_CATEGORIES.items():
            group, created = JobCategory.objects.update_or_create(
                name=group_name,
                defaults={
                    'parent': None,
                    'category_type': JobCategory.CategoryType.OCCUPATION_GROUP,
                    'status': JobCategory.Status.ACTIVE,
                },
            )
            count += created
            seen.append(group_name)
            for job_name, positions in jobs.items():
                job, created = JobCategory.objects.update_or_create(
                    name=job_name,
                    defaults={
                        'parent': group,
                        'category_type': JobCategory.CategoryType.DOMAIN,
                        'status': JobCategory.Status.ACTIVE,
                    },
                )
                count += created
                seen.append(job_name)
                for pos_name in positions:
                    position, created = JobCategory.objects.update_or_create(
                        name=pos_name,
                        defaults={
                            'parent': job,
                            'category_type': JobCategory.CategoryType.SPECIALIZATION,
                            'status': JobCategory.Status.ACTIVE,
                        },
                    )
                    count += created
                    seen.append(pos_name)
                    JobCategoryLocalization.objects.get_or_create(
                        category=position,
                        locale=JobCategoryLocalization.Locale.VI,
                        defaults={'display_name': pos_name, 'is_active': True},
                    )
                    for locale, display_name in POSITION_LOCALIZATIONS[pos_name].items():
                        JobCategoryLocalization.objects.get_or_create(
                            category=position,
                            locale=locale,
                            defaults={'display_name': display_name, 'is_active': True},
                        )
        # Retire leftovers from older seeds so the public tree stays clean.
        retired = JobCategory.objects.exclude(name__in=seen).update(
            status=JobCategory.Status.INACTIVE
        )
        self.stdout.write(self.style.SUCCESS(f'Seeded: {count} created, {retired} retired.'))
