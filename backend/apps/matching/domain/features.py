"""Khóa cấu hình bật/tắt từng chỗ dùng của đối sánh CV–tin (nhóm `ai` ở Cấu hình hệ thống).

Đặt ở `domain` vì cả services (ghi, xếp task) lẫn selectors (đọc cho API) đều cần,
mà hai tầng đó không import lẫn nhau.
"""

# Ứng viên bấm "Xem độ phù hợp" trên một tin.
CANDIDATE_FIT_FLAG = 'ai_job_match_enabled'
# "Việc làm gợi ý" theo nội dung CV.
SEMANTIC_RECOMMENDATION_FLAG = 'ai_job_recommendation_semantic_enabled'
# Nhà tuyển dụng thấy mức phù hợp của hồ sơ ứng tuyển (chỉ hồ sơ ứng viên đồng ý).
APPLICATION_RANKING_FLAG = 'ai_application_ranking_enabled'
# Nhà tuyển dụng tìm ứng viên đang bật "cho phép NTD tìm kiếm" theo một tin (Tìm CV).
CANDIDATE_SEARCH_FLAG = 'ai_candidate_search_enabled'

# Bật bất kỳ cờ nào thì vector của CV và tin được tính sẵn.
FEATURE_FLAGS = (
    CANDIDATE_FIT_FLAG,
    SEMANTIC_RECOMMENDATION_FLAG,
    APPLICATION_RANKING_FLAG,
    CANDIDATE_SEARCH_FLAG,
)
