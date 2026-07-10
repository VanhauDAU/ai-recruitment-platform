# Shared Components

Folder này chỉ chứa component dùng chung ở nhiều feature hoặc nhiều layout.

Quy ước:

- `ui/`: primitive UI hoặc widget dùng lại rộng rãi, không gắn nghiệp vụ cụ thể.
- `layout/`: shell layout cấp site như header/footer.
- `auth/`, `brand/`, `site/`, `admin/`: component shared theo domain nhỏ, được dùng từ nhiều page/layout.
- `job/`: component job domain thật sự dùng chung nhiều màn. Component chỉ dùng cho trang danh sách việc làm đặt ở `pages/main/jobs/components/`.

Component chỉ phục vụ một page hoặc một feature nên đặt cạnh page đó, ví dụ:

- `pages/main/components/home/` cho các section riêng của trang chủ.
- `pages/main/jobs/components/` cho UI riêng của danh sách việc làm.
- `pages/main/jobs/hooks/` và `pages/main/jobs/utils/` cho logic riêng của feature jobs.
