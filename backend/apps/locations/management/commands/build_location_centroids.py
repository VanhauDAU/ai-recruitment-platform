"""Offline builder for apps/locations/seed_data/centroids.json (ADR-0029).

Input: the post-2025 boundary GeoJSON published (MIT) by
https://github.com/ThangLeQuoc/vietnamese-provinces-database
(`dataset-generation-scripts/resources/gis/geojson_<date>.zip`, unzipped): one
folder per province holding `province.geojson` and `wards/<n>_<name>_<type>.geojson`.

The dataset has no official codes, so wards are matched by name inside their
province. File names drop some words ("quan", "phuong", "thanh"…), hence the
token fallback below. Run once whenever boundaries change, review the report,
commit the JSON, then `seed_location_coordinates` loads it with no network.
"""

import json
import re
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from apps.locations.domain import polygon_label_point
from apps.locations.models import Location
from common.db.search import fold_accents

DEFAULT_OUTPUT = Path(__file__).resolve().parents[2] / 'seed_data' / 'centroids.json'
SOURCE = 'ThangLeQuoc/vietnamese-provinces-database (MIT), ranh giới sau 01/07/2025'
_DROPPED_WORDS = {'phuong', 'xa', 'quan', 'thanh', 'dac', 'khu', 'huyen', 'thi', 'tran', 'pho'}
# Tên file bị cắt mất cả một từ — ghép tay sau khi đối chiếu báo cáo.
_FILE_ALIASES = {('thanh_pho_ha_noi', 'cmy'): 'xa_chuyen_my'}


def _slug(text):
    return re.sub(r'[^a-z0-9]+', '_', fold_accents(text)).strip('_')


def _tokens(text):
    return tuple(t for t in _slug(text).split('_') if t not in _DROPPED_WORDS)


def _province_key(name):
    return re.sub(r'^(tinh|thanh_pho|thu_do)_', '', _slug(name))


def _read_point(path):
    data = json.loads(path.read_text(encoding='utf-8'))
    features = data.get('features') or [data]
    return polygon_label_point(features[0]['geometry'])


class Command(BaseCommand):
    help = 'Build ward/province centroids JSON from boundary GeoJSON (offline, run manually).'

    def add_arguments(self, parser):
        parser.add_argument('geojson_dir', help='Unzipped geojson_<date> folder')
        parser.add_argument('--output', default=str(DEFAULT_OUTPUT))

    def handle(self, *args, geojson_dir, output, **options):
        base = Path(geojson_dir)
        if not base.is_dir():
            raise CommandError(f'{base} is not a directory')
        provinces = {
            _province_key(p.name): p for p in Location.objects.filter(level=Location.Level.PROVINCE)
        }
        points, report = {}, []
        for folder in sorted(p for p in base.iterdir() if p.is_dir()):
            key = _province_key(re.sub(r'^\d+_', '', folder.name))
            province = provinces.get(key)
            if province is None:
                report.append(f'Không khớp tỉnh: {folder.name}')
                continue
            if (folder / 'province.geojson').exists():
                points[province.code] = _read_point(folder / 'province.geojson')
            self._match_wards(folder, province, points, report)

        missing = Location.objects.exclude(code__in=points).values_list('name', 'parent__name')
        report += [f'Thiếu tâm: {name} ({parent or "tỉnh"})' for name, parent in missing]
        payload = {
            'source': SOURCE,
            'generated_at': timezone.now().date().isoformat(),
            'locations': dict(sorted(points.items())),
        }
        Path(output).write_text(
            json.dumps(payload, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8'
        )
        for line in report:
            self.stdout.write(self.style.WARNING(line))
        self.stdout.write(self.style.SUCCESS(f'Wrote {len(points)} centroids to {output}'))

    def _match_wards(self, folder, province, points, report):
        wards = list(Location.objects.filter(level=Location.Level.WARD, parent=province))
        by_slug = {_slug(w.name): w for w in wards}
        pending = []
        for path in sorted((folder / 'wards').glob('*.geojson')):
            stem = _slug(re.sub(r'^\d+_', '', path.stem))
            match = re.match(r'(.+)_(phuong|xa|dac_khu)$', stem)
            if not match:
                report.append(f'Tên file lạ: {path.name}')
                continue
            name, kind = match.groups()
            alias = _FILE_ALIASES.get((_slug(province.name), name))
            ward = by_slug.get(alias or f'{kind}_{name}')
            if ward and ward.code not in points:
                points[ward.code] = _read_point(path)
            else:
                pending.append((path, kind, _tokens(name)))
        left = [w for w in wards if w.code not in points]
        for path, kind, tokens in pending:
            hits = [w for w in left if _tokens(w.name) == tokens and _slug(w.ward_type) == kind]
            if len(hits) != 1:
                hits = [w for w in left if tokens and set(tokens) <= set(_tokens(w.name))]
            if len(hits) == 1:
                points[hits[0].code] = _read_point(path)
                left.remove(hits[0])
            else:
                report.append(f'Không khớp phường: {province.name} / {path.name}')
