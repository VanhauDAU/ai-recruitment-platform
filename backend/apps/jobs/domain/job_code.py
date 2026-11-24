"""Mã tin tuyển dụng hiển thị (`Job.code`), ví dụ J4829173.

Tách khỏi `public_id` (khóa API, nằm trong slug SEO): mã này chỉ để người dùng
đọc cho bộ phận hỗ trợ và để quản trị viên tra cứu.
"""

from functools import partial

from common.db.readable_code import random_readable_code, readable_code_regex

JOB_CODE_PREFIX = 'J'
JOB_CODE_DIGITS = 7
JOB_CODE_LENGTH = len(JOB_CODE_PREFIX) + JOB_CODE_DIGITS
JOB_CODE_REGEX = readable_code_regex(JOB_CODE_DIGITS, JOB_CODE_PREFIX)

random_job_code = partial(random_readable_code, JOB_CODE_DIGITS, JOB_CODE_PREFIX)
