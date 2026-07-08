from django.core.management.base import BaseCommand

from apps.locations.models import Location

# Sáp nhập đơn vị hành chính cấp tỉnh 2025 (hiệu lực 1/7/2025): 63 -> 34 tỉnh/thành.
# Key = tên tỉnh MỚI (đã bỏ tiền tố "Tỉnh/Thành phố"); value = danh sách tên các tỉnh CŨ
# hợp thành (gồm cả tỉnh giữ tên). 11 tỉnh không sáp nhập không có trong dict -> merged_from = [].
# Nguồn: Nghị quyết sắp xếp ĐVHC cấp tỉnh 2025 (xaydungchinhsach.chinhphu.vn, thuvienphapluat.vn).
PROVINCE_MERGES = {
    'Tuyên Quang': ['Hà Giang', 'Tuyên Quang'],
    'Lào Cai': ['Yên Bái', 'Lào Cai'],
    'Thái Nguyên': ['Bắc Kạn', 'Thái Nguyên'],
    'Phú Thọ': ['Vĩnh Phúc', 'Hòa Bình', 'Phú Thọ'],
    'Bắc Ninh': ['Bắc Giang', 'Bắc Ninh'],
    'Hưng Yên': ['Thái Bình', 'Hưng Yên'],
    'Hải Phòng': ['Hải Dương', 'Hải Phòng'],
    'Ninh Bình': ['Hà Nam', 'Nam Định', 'Ninh Bình'],
    'Quảng Trị': ['Quảng Bình', 'Quảng Trị'],
    'Đà Nẵng': ['Quảng Nam', 'Đà Nẵng'],
    'Quảng Ngãi': ['Kon Tum', 'Quảng Ngãi'],
    'Gia Lai': ['Bình Định', 'Gia Lai'],
    'Khánh Hòa': ['Ninh Thuận', 'Khánh Hòa'],
    'Lâm Đồng': ['Đắk Nông', 'Bình Thuận', 'Lâm Đồng'],
    'Đắk Lắk': ['Phú Yên', 'Đắk Lắk'],
    'Hồ Chí Minh': ['Bà Rịa - Vũng Tàu', 'Bình Dương', 'Hồ Chí Minh'],
    'Đồng Nai': ['Bình Phước', 'Đồng Nai'],
    'Tây Ninh': ['Long An', 'Tây Ninh'],
    'Cần Thơ': ['Sóc Trăng', 'Hậu Giang', 'Cần Thơ'],
    'Vĩnh Long': ['Bến Tre', 'Trà Vinh', 'Vĩnh Long'],
    'Đồng Tháp': ['Tiền Giang', 'Đồng Tháp'],
    'Cà Mau': ['Bạc Liêu', 'Cà Mau'],
    'An Giang': ['Kiên Giang', 'An Giang'],
}

# Bỏ tiền tố đơn vị hành chính để so khớp theo tên ngắn ("Thành phố Đà Nẵng" -> "Đà Nẵng").
_PREFIXES = ('Thành phố ', 'Tỉnh ')


def short_name(name):
    for prefix in _PREFIXES:
        if name.startswith(prefix):
            return name[len(prefix):]
    return name


class Command(BaseCommand):
    help = 'Gán tên các tỉnh cũ (sáp nhập 2025) vào Location.merged_from cho từng tỉnh mới.'

    def handle(self, *args, **options):
        provinces = Location.objects.filter(level=Location.Level.PROVINCE)
        matched = 0
        for province in provinces:
            key = short_name(province.name)
            old_names = PROVINCE_MERGES.get(key, [])
            if province.merged_from != old_names:
                province.merged_from = old_names
                province.save(update_fields=['merged_from'])
            if old_names:
                matched += 1
                self.stdout.write(f'  {province.name} <- {", ".join(old_names)}')

        missing = set(PROVINCE_MERGES) - {short_name(p.name) for p in provinces}
        if missing:
            self.stdout.write(self.style.WARNING(f'Không khớp được tỉnh mới trong DB: {sorted(missing)}'))
        self.stdout.write(self.style.SUCCESS(f'Xong: {matched}/{len(PROVINCE_MERGES)} tỉnh sáp nhập đã gán.'))
