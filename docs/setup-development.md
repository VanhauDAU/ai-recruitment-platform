# Setup development — runtime & migration discipline

Tài liệu ngắn gọn để môi trường **local, CI và deploy dùng chung một runtime** và
để migration luôn chạy sạch. Hướng dẫn cài đặt đầy đủ (Node, seed, chạy app) xem
[`05-huong-dan/huong-dan-cai-dat.md`](05-huong-dan/huong-dan-cai-dat.md).

## Python được khóa: 3.11

Phiên bản được khóa qua `.python-version` (repo root) và `backend/.python-version`.
Local, CI (`.github/workflows/backend-ci.yml`) và deploy phải dùng cùng
**major.minor** = `3.11`.

Dựng backend từ đầu bằng một lệnh (script tự kiểm tra đúng Python 3.11):

```bash
./scripts/bootstrap-backend.sh
```

Nếu dùng `pyenv`:

```bash
pyenv install 3.11
pyenv local 3.11   # đã có sẵn .python-version trong repo
```

## Quy tắc migration: Expand → Backfill → Contract

Mọi thay đổi schema nguy hiểm (đổi NOT NULL, thêm FK bắt buộc, backfill dữ liệu)
phải tách theo ba bước, **mỗi bước một migration**:

1. **Expand** — thêm cột/FK ở dạng `null=True`. Không backfill, không đổi NOT NULL.
2. **Backfill** — chỉ đụng dữ liệu (`RunPython`, `atomic = False`), **idempotent**
   (chạy lại nhiều lần không tạo bản trùng, không lỗi unique).
3. **Contract** — kiểm tra không còn NULL rồi mới `AlterField` NOT NULL + thêm index.

Tách như vậy đảm bảo các "deferred FK trigger events" được commit giữa các bước,
tránh lỗi PostgreSQL `cannot ALTER TABLE ... because it has pending trigger events`
trên database đã có dữ liệu cũ.

Tham chiếu mẫu: `backend/apps/applications/migrations/0004_application_snapshot_expand.py`
→ `0005_application_snapshot_backfill.py` → `0006_application_snapshot_contract.py`,
kèm test nâng cấp `backend/apps/applications/tests_migrations.py`.

### Không được

- `migrate --fake` để bỏ qua một migration đang lỗi trên dữ liệu thật.
- Reset/drop database chỉ để migration chạy.
- Xóa migration đã áp dụng ở môi trường dùng chung.
- Gộp backfill dữ liệu và `ALTER` constraint nguy hiểm trong cùng một bước.
- Hard-delete `CvVersion` đang được `Application` tham chiếu.

## Kiểm tra runtime (khớp CI)

```bash
cd backend
python --version                              # phải là 3.11.x
python manage.py check
python manage.py makemigrations --check --dry-run   # không được có migration treo
python manage.py migrate
python manage.py test                          # gồm cả test nâng cấp migration
```

Test nâng cấp migration (`apps.applications.tests_migrations`) chạy trên PostgreSQL
thật: nó lùi `applications` về `0003`, tạo một application "legacy" không có
snapshot, rồi migrate lên mới nhất và khẳng định snapshot được backfill đúng.
