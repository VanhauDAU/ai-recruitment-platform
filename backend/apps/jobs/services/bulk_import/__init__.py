"""Nhập hàng loạt tin tuyển dụng do người vận hành chuẩn bị (dữ liệu demo và tập đánh giá).

Mỗi dòng đi đúng các bước của một tin thật: tạo bản nháp cùng dữ liệu liên quan,
kiểm tra đủ điều kiện đăng rồi đưa lên công khai. Dòng có lỗi được báo nguyên
nhân và không tạo gì. Chạy thử (`apply=False`) thực hiện toàn bộ rồi hoàn tác,
nên báo cáo chạy thử phản ánh đúng những gì lần ghi thật sẽ làm.
"""

from .importer import import_job_postings
from .rows import rich_text_from_lines

__all__ = ['import_job_postings', 'rich_text_from_lines']
