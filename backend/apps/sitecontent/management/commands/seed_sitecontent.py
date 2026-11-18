import json
from pathlib import Path

from django.core.management.base import BaseCommand

from apps.sitecontent.models import Banner, LinkGroup, LinkItem, SiteSetting

# Cấu hình mẫu để trang chạy ngay; admin chỉnh/thêm sau qua trang quản trị.
# Seed idempotent: đồng bộ metadata (label/group/type/options/order/is_public)
# nhưng KHÔNG ghi đè value admin đã chỉnh. Dữ liệu nằm trong seed_data/*.json;
# thứ tự bản ghi trong settings.json quyết định `order` trong từng nhóm.
SEED_DATA_DIR = Path(__file__).resolve().parents[2] / 'seed_data'

# Logo cũ không còn trong frontend/public (2 ảnh gốc nặng 957KB/376KB đã bị
# xoá) — DB nào còn trỏ vào là ảnh vỡ, nên seed ép về giá trị mặc định mới.
LEGACY_BRAND_VALUES = {
    '',
    '/images/logo/aicareer-logo.svg',
    '/favicon.svg',
    '/images/logo/logo_proCV_2000_2000.png',
    '/images/logo/logo_proCV_2000_600.png',
}
BRAND_ASSET_KEYS = {'brand_logo_url', 'brand_logo_mark_url', 'brand_favicon_url'}


def load_seed_data(name):
    return json.loads((SEED_DATA_DIR / f'{name}.json').read_text(encoding='utf-8'))


def _assign_changed(instance, values):
    """Copy differing values onto ``instance``; return the names that changed."""
    changed = []
    for field, value in values.items():
        if getattr(instance, field) != value:
            setattr(instance, field, value)
            changed.append(field)
    return changed


class Command(BaseCommand):
    help = 'Tạo dữ liệu cấu hình & cụm link mặc định (idempotent, không ghi đè value đã chỉnh).'

    def handle(self, *args, **options):
        self._seed_settings()
        self._seed_link_groups()
        self._seed_banners()
        self.stdout.write(self.style.SUCCESS('Seed sitecontent xong.'))

    def _seed_settings(self):
        order_in_group = {}
        for row in load_seed_data('settings'):
            key, value, group = row['key'], row['value'], row['group']
            order_in_group[group] = order_in_group.get(group, 0) + 1
            metadata = {
                'label': row['label'],
                'group': group,
                'value_type': row['value_type'],
                'options': row['options'],
                'order': order_in_group[group],
                'description': row['description'],
                'is_public': row['is_public'],
            }
            setting, created = SiteSetting.objects.get_or_create(
                key=key, defaults={**metadata, 'value': value}
            )
            if not created:
                changed = bool(_assign_changed(setting, metadata))
                if key in BRAND_ASSET_KEYS and setting.value in LEGACY_BRAND_VALUES:
                    setting.value = value
                    changed = True
                if changed:
                    setting.save()
            self.stdout.write(f'{"+ " if created else "= "}setting {key}')

    def _seed_link_groups(self):
        for row in load_seed_data('link_groups'):
            key = row['key']
            values = {field: row[field] for field in ('title', 'source', 'placement', 'order')}
            group, created = LinkGroup.objects.get_or_create(key=key, defaults=values)
            if not created:
                changed_fields = _assign_changed(group, values)
                if changed_fields:
                    group.save(update_fields=changed_fields)
            self.stdout.write(f'{"+ " if created else "= "}group {key}')
            # Link nhập tay chỉ seed lần đầu; sau đó admin toàn quyền chỉnh.
            # URL rỗng => frontend hiển thị "Sắp ra mắt".
            if created and row['source'] == LinkGroup.Source.MANUAL:
                LinkItem.objects.bulk_create(
                    [
                        LinkItem(group=group, label=item['label'], url=item['url'], order=index)
                        for index, item in enumerate(row['items'])
                    ]
                )

    def _seed_banners(self):
        for row in load_seed_data('banners'):
            defaults = {field: value for field, value in row.items() if field != 'title'}
            _, created = Banner.objects.get_or_create(title=row['title'], defaults=defaults)
            self.stdout.write(f'{"+ " if created else "= "}banner {row["title"]}')
