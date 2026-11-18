"""Đường dẫn dữ liệu dùng chung cho các script trong `ml/scripts/` (xem `ml/README.md`)."""

from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
ML_DIR = REPO_ROOT / 'ml'
DATA_DIR = ML_DIR / 'data'
MODELS_DIR = ML_DIR / 'models'

# Tin tuyển dụng thật do người làm đồ án nhập.
JD_DIR = DATA_DIR / 'jd'
JD_INPUT = JD_DIR / 'jd_input.xlsx'
JD_IMPORT_MAP = JD_DIR / 'jd_import_map.json'

# Kho CV: bản JSON tổng hợp, bản PDF hệ thống xuất, bản PDF TopCV xuất.
CV_DIR = DATA_DIR / 'cv'
CV_INVENTORY = CV_DIR / 'cv_inventory.xlsx'
SYNTHETIC_CV_DIR = CV_DIR / 'synthetic'
CV_MANIFEST = SYNTHETIC_CV_DIR / 'manifest.json'
CV_PDF_SYSTEM_DIR = CV_DIR / 'pdf' / 'system'
CV_PDF_TOPCV_DIR = CV_DIR / 'pdf' / 'topcv'
