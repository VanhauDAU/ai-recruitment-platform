from django.db import migrations
from django.utils.text import slugify


INDUSTRIES = [
    'IT - Phần mềm', 'Kế toán / Kiểm toán', 'Luật', 'Bảo hiểm',
    'Bất động sản', 'Dược phẩm / Y tế / Công nghệ sinh học',
    'Internet / Online', 'Marketing / Truyền thông / Quảng cáo',
    'Nhà hàng / Khách sạn', 'In ấn / Xuất bản',
    'Bán lẻ - Hàng tiêu dùng - FMCG', 'Sản xuất', 'Chứng khoán',
    'Xây dựng', 'Ngân hàng', 'Nhân sự', 'Thiết kế / kiến trúc',
    'Môi trường', 'Xuất nhập khẩu', 'Bảo trì / Sửa chữa',
    'Điện tử / Điện lạnh', 'Thời trang', 'Cơ khí', 'Tư vấn',
    'Viễn thông', 'Giáo dục / Đào tạo', 'Thương mại điện tử',
    'Logistics - Vận tải', 'Tổ chức phi lợi nhuận', 'Cơ quan nhà nước',
    'Du lịch', 'Tự động hóa', 'Agency (Design/Development)',
    'Agency (Marketing/Advertising)', 'Năng lượng', 'Giải trí',
    'IT - Phần cứng', 'Nông Lâm Ngư nghiệp', 'Tài chính',
    'Thương mại tổng hợp', 'Khác',
]


def seed_industries(apps, schema_editor):
    Industry = apps.get_model('employers', 'Industry')
    for name in INDUSTRIES:
        if Industry.objects.filter(name=name).exists():
            continue
        base_slug = slugify(name) or 'industry'
        slug = base_slug
        suffix = 2
        while Industry.objects.filter(slug=slug).exists():
            slug = f'{base_slug}-{suffix}'
            suffix += 1
        Industry.objects.create(name=name, slug=slug)


class Migration(migrations.Migration):
    dependencies = [('employers', '0013_recruitmentneed_multiple_active')]
    operations = [migrations.RunPython(seed_industries, migrations.RunPython.noop)]
