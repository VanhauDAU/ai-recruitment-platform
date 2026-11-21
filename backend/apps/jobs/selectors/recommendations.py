"""Gợi ý việc làm cho ứng viên: theo ngữ nghĩa khi có thể, theo luật khi không.

Trang "Việc làm phù hợp" và trang lưu CV thành công dùng chiến lược `semantic-v1`
(`apps.matching.selectors.rank_jobs_for_cv`) khi đủ ba điều kiện:

- cờ `ai_job_recommendation_semantic_enabled` bật;
- ứng viên đã đồng ý nhận gợi ý bằng AI (cùng đồng ý với bộ gợi ý theo luật);
- CV dùng để gợi ý đã có vector (được tính sẵn khi lưu CV), và có ít nhất một tin đủ gần.

Nhu cầu đã khai không bắt buộc nhưng lái thứ hạng (`recommendation_intent`): tin đúng vị
trí mong muốn luôn được xét và được cộng điểm, cùng điểm cộng nhỏ cho tỉnh, lương, kinh
nghiệm.

Ứng viên tắt gợi ý bằng AI vẫn thấy danh sách nhưng không đọc CV: theo nhu cầu đã khai,
hoặc tin mới nhất khi chưa khai (`latest-v1`).

Thiếu một điều kiện khác thì dùng bộ gợi ý theo luật như trước (`candidate-preference-rule-v2`,
`profile-rule-v2`), kể cả việc báo "cần thiết lập nhu cầu" hay "cần đồng ý". Email gợi
ý và tin chèn trong danh sách việc làm vẫn theo luật.
"""

from apps.matching.selectors import (
    MIN_SEMANTIC_SCORE,
    SEMANTIC_STRATEGY,
    cv_document_for,
    rank_jobs_for_cv,
    recommendation_cv,
)
from apps.sitecontent.selectors import get_bool_setting

from ..models.querysets import active_jobs_queryset
from ..models.recommendation_queries import (
    MIN_RECOMMENDATION_SCORE,
    RecommendationConsentRequired,
    ai_recommendation_allowed,
    paginate,
    preference_state,
    recommend_inline_jobs_for_candidate,
    recommend_latest_jobs_for_candidate,
    recommend_new_jobs_for_candidate_email,
    recommendable_jobs,
    rule_scores_for_cv,
)
from ..models.recommendation_queries import (
    recommend_jobs_for_candidate as rule_recommendations_for_candidate,
)
from ..models.recommendation_queries import (
    recommend_jobs_for_cv as rule_recommendations_for_cv,
)
from .recommendation_intent import preference_intent, ranking_intent

SEMANTIC_FLAG = 'ai_job_recommendation_semantic_enabled'

__all__ = [
    'MIN_RECOMMENDATION_SCORE',
    'RecommendationConsentRequired',
    'recommend_inline_jobs_for_candidate',
    'recommend_jobs_for_candidate',
    'recommend_jobs_for_cv',
    'recommend_new_jobs_for_candidate_email',
    'ranking_intent',
    'rule_scores_for_cv',
    'semantic_recommendations_enabled',
]


def semantic_recommendations_enabled():
    return get_bool_setting(SEMANTIC_FLAG, default=False)


def _semantic_ranking(user, cv, preference):
    """Thứ hạng `semantic-v1` của một CV theo nhu cầu đã khai, hoặc None nếu CV chưa có vector."""
    document = cv_document_for(cv)
    if document is None:
        return None
    jobs = recommendable_jobs(user)
    return rank_jobs_for_cv(document, jobs, intent=preference_intent(jobs, preference, cv))


def _with_jobs(ranked):
    """Gắn bản ghi tin (nạp như danh sách việc làm công khai) vào từng kết quả, giữ thứ tự."""
    jobs = active_jobs_queryset().in_bulk([item['job_id'] for item in ranked])
    return [{**item, 'job': jobs[item['job_id']]} for item in ranked if item['job_id'] in jobs]


def _focus(cv):
    content = cv.latest_version.content_json if cv.latest_version else {}
    personal = content.get('personal_info', {}) if isinstance(content, dict) else {}
    return str(personal.get('headline') or personal.get('job_title') or cv.title or '').strip()


def _semantic_context(user, public_id=None, state=None):
    """(CV, nhu cầu, thứ hạng) khi gợi ý theo ngữ nghĩa được; None khi phải dùng luật."""
    if not semantic_recommendations_enabled():
        return None
    profile, preference = state or preference_state(user)
    if not ai_recommendation_allowed(profile):
        return None
    cv = recommendation_cv(user, public_id)
    ranked = None if cv is None else _semantic_ranking(user, cv, preference)
    # Không tin nào đủ gần CV thì gợi ý theo luật, không trả danh sách rỗng.
    return (cv, profile, preference, ranked) if ranked else None


def recommend_jobs_for_cv(user, public_id, *, limit=6):
    """Gợi ý cho một CV vừa lưu (trang lưu CV thành công)."""
    context = _semantic_context(user, public_id)
    if context is None:
        return rule_recommendations_for_cv(user, public_id, limit=limit)
    cv, _profile, _preference, ranked = context
    return {
        'focus_keyword': _focus(cv),
        'strategy': SEMANTIC_STRATEGY,
        'minimum_match_score': MIN_SEMANTIC_SCORE,
        'results': _with_jobs(ranked[:limit]),
        'related_positions': [],
    }


def _without_ai(user, profile, preference, *, page, page_size):
    """Danh sách khi ứng viên tắt gợi ý bằng AI: không đọc CV.

    Đã khai nhu cầu thì xếp theo nhu cầu (luật, không đọc CV); chưa khai thì tin mới nhất.
    """
    if profile and profile.job_preferences_configured and preference:
        return rule_recommendations_for_candidate(
            user, page=page, page_size=page_size, require_consent=False
        )
    return recommend_latest_jobs_for_candidate(user, page=page, page_size=page_size)


def recommend_jobs_for_candidate(user, *, page=1, page_size=10):
    """Trang "Việc làm phù hợp": theo CV mặc định của ứng viên, không cần khai nhu cầu trước.

    Ứng viên tắt gợi ý bằng AI vẫn thấy danh sách (`_without_ai`), kèm
    `ai_recommendation_enabled = false` để giao diện mời bật lại.
    """
    profile, preference = preference_state(user)
    flags = {'cv_recommendations_enabled': semantic_recommendations_enabled()}
    if not ai_recommendation_allowed(profile):
        payload = _without_ai(user, profile, preference, page=page, page_size=page_size)
        return {**payload, **flags, 'ai_recommendation_enabled': False}
    flags['ai_recommendation_enabled'] = True
    context = _semantic_context(user, state=(profile, preference))
    if context is None:
        return {
            **rule_recommendations_for_candidate(user, page=page, page_size=page_size),
            **flags,
        }
    cv, profile, preference, ranked = context
    selected, pagination = paginate(ranked, page, page_size)
    preferences_ready = bool(profile and profile.job_preferences_configured and preference)
    return {
        **flags,
        'strategy': SEMANTIC_STRATEGY,
        'minimum_match_score': MIN_SEMANTIC_SCORE,
        'preference_configured': preferences_ready,
        'sources': {'job_preferences': preferences_ready, 'cv': True, 'search_activity': False},
        'source_cv': {'public_id': cv.public_id, 'title': cv.title, 'is_default': cv.is_default},
        'focus_keyword': _focus(cv),
        'related_positions': [],
        'results': _with_jobs(selected),
        'status': 'ready',
        'needs_setup': False,
        'consent_required': False,
        'pagination': pagination,
    }
