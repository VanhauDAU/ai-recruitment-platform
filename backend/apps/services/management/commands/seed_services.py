"""Backward-compatible entry point for the curated commercial catalog.

Deploy/runbooks historically call ``seed_services``. Keep that stable command
name, but never recreate the retired TopCV-inspired sample catalog.
"""

from .seed_service_commercial_pilot import Command as CuratedCatalogCommand


class Command(CuratedCatalogCommand):
    help = 'Đồng bộ catalog dịch vụ tuyển dụng đã chọn lọc và dọn dữ liệu mẫu cũ.'
