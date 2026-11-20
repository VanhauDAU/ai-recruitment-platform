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

# Tập vàng: phiếu chấm (commit) và bản đã nộp, thông tin ghép cặp (không commit).
LABELING_DIR = ML_DIR / 'labeling'
GOLD_SHEET = LABELING_DIR / 'gold_pairs.xlsx'
# Đợt 2 của tập vàng (15 JD thêm, 20/11): phiếu chấm mù và nhãn của Claude.
GOLD_SHEET_2 = LABELING_DIR / 'gold_pairs_2.xlsx'
GOLD_CLAUDE_SHEETS = [LABELING_DIR / 'gold_pairs_claude.xlsx', LABELING_DIR / 'gold_pairs_claude_2.xlsx']
SKILL_MERGE = LABELING_DIR / 'skill_merge.json'
LABELS_DIR = DATA_DIR / 'labels'
GOLD_POOL = LABELS_DIR / 'gold_pool.json'

# Bảng số liệu đưa vào báo cáo (commit).
REPORTS_DIR = ML_DIR / 'reports'

# profile_json xuất từ hệ thống (`export_profiles.py`), không commit.
PROFILES_DIR = DATA_DIR / 'profiles'

# Điểm từng cặp do `evaluate.py` lưu lại (không commit).
EVAL_DIR = DATA_DIR / 'eval'

# Dữ liệu công khai tải về bằng `fetch_public.py`, kèm `SOURCES.md` (không commit).
PUBLIC_DIR = DATA_DIR / 'public'
