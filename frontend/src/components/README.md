# Shared Components

Folder này chỉ chứa component dùng chung ở nhiều feature hoặc nhiều layout.

Quy ước:

- `ui/`: primitive UI hoặc widget dùng lại rộng rãi, không gắn nghiệp vụ cụ thể.
- `layout/`: shell layout cấp site như header/footer.
- `auth/`, `brand/`, `site/`, `admin/`: component shared theo domain nhỏ, được dùng từ nhiều page/layout.
- `job/`: component job domain thật sự dùng chung nhiều màn. Component chỉ dùng cho candidate Jobs đặt ở `features/jobs/pages/candidate/components/`.

Component chỉ phục vụ một page hoặc một feature nên đặt cạnh page đó, ví dụ:

- `pages/main/components/home/` cho các section riêng của trang chủ.
- `features/jobs/pages/candidate/components/` cho UI riêng của danh sách việc làm.
- `features/jobs/pages/candidate/hooks/` và `features/jobs/pages/candidate/utils/` cho logic riêng của feature jobs.
