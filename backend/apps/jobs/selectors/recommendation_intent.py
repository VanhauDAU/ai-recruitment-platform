"""Nhu cầu tìm việc của ứng viên dưới dạng `RankingIntent` cho gợi ý theo ngữ nghĩa.

CV kể ứng viên đã làm gì; nhu cầu nói ứng viên muốn làm gì tiếp. Gợi ý theo ngữ nghĩa
xếp theo CV, nên nhu cầu được đưa vào bằng hai cách:

- Tin thuộc vị trí mong muốn (vị trí chuyên môn đã chọn, hoặc tiêu đề chứa vị trí tự
  nhập) luôn được xét, được cộng `DESIRED_POSITION_BONUS` và không bị ngưỡng điểm cắt.
  Người đổi nghề vẫn thấy tin theo hướng mới; giữa các tin đó, CV quyết định thứ tự.
- Điểm cộng nhỏ, không loại tin nào: đúng tỉnh mong muốn, lương chạm mức mong muốn,
  số năm kinh nghiệm vừa với yêu cầu của tin.

Mỗi điểm cộng đi kèm một lý do hiển thị cho ứng viên. Mức cộng vị trí chọn bằng phép đo
trên nhãn yếu (`ml/scripts/evaluate_recommendations.py --intent-study`, 100 CV): ở +0,40,
CV khai một nghề mới có 34% tin nghề mới trong 10 gợi ý đầu (trần 36%, đúng số tin nghề
đó đang có) mà vẫn giữ 23% tin nghề cũ; CV khai đúng nghề cũ không tụt tin neo.
"""

from django.db.models import Q
from django.utils.translation import gettext as _

from apps.matching.selectors import Bonus, RankingIntent

from ..models import Job, JobCategoryAssignment, JobLocation
from ..models.recommendation_queries import EXPERIENCE_RANK, normalize_term, salary_fits

DESIRED_POSITION_BONUS = 0.40
PREFERRED_PROVINCE_BONUS = 0.05
SALARY_BONUS = 0.03
EXPERIENCE_BONUS = 0.03
# Kinh nghiệm "vừa": đủ yêu cầu của tin và không vượt quá hai bậc (người 5 năm không
# được cộng điểm cho tin không yêu cầu kinh nghiệm).
EXPERIENCE_BAND = 2


def _experience_fits(required, candidate):
    if not required or not candidate:
        return False
    need, have = EXPERIENCE_RANK.get(required, 0), EXPERIENCE_RANK.get(candidate, 0)
    return need <= have <= need + EXPERIENCE_BAND


def ranking_intent(
    job_queryset,
    *,
    category_ids=(),
    position_names=(),
    province_ids=(),
    desired_salary=None,
    experience_level='',
    position_bonus=DESIRED_POSITION_BONUS,
):
    """`RankingIntent` từ các giá trị nhu cầu; dùng cho ứng viên thật và cho phép đo
    (`position_bonus` chỉ đổi khi dò mức cộng)."""
    category_ids, province_ids = set(category_ids), set(province_ids)
    names = [name.strip() for name in position_names if name and name.strip()]
    folded_names = [normalize_term(name) for name in names]

    focus = Q()
    if category_ids:
        focus |= Q(
            category_assignments__category_id__in=category_ids,
            category_assignments__role=JobCategoryAssignment.Role.PRIMARY_SPECIALIZATION,
        )
    for name in names:
        focus |= Q(title__icontains=name)

    def bonuses(job_ids):
        jobs = Job.objects.filter(pk__in=job_ids).only(
            'pk', 'title', 'salary_type', 'currency', 'salary_min', 'salary_max', 'experience_years'
        )
        desired_jobs = set()
        if category_ids:
            desired_jobs |= set(
                JobCategoryAssignment.objects.filter(
                    job_id__in=job_ids,
                    category_id__in=category_ids,
                    role=JobCategoryAssignment.Role.PRIMARY_SPECIALIZATION,
                ).values_list('job_id', flat=True)
            )
        preferred_jobs = set()
        if province_ids:
            preferred_jobs = set(
                JobLocation.objects.filter(job_id__in=job_ids)
                .filter(Q(location_id__in=province_ids) | Q(location__parent_id__in=province_ids))
                .values_list('job_id', flat=True)
            )
        result = {}
        for job in jobs:
            title = normalize_term(job.title)
            extra = []
            if job.pk in desired_jobs or any(name in title for name in folded_names):
                extra.append(Bonus(position_bonus, _('Đúng vị trí bạn mong muốn'), declared=True))
            if job.pk in preferred_jobs:
                extra.append(Bonus(PREFERRED_PROVINCE_BONUS, _('Đúng nơi làm việc bạn mong muốn')))
            if salary_fits(job, desired_salary):
                extra.append(Bonus(SALARY_BONUS, _('Mức lương hợp mong muốn của bạn')))
            if _experience_fits(job.experience_years, experience_level):
                extra.append(Bonus(EXPERIENCE_BONUS, _('Số năm kinh nghiệm vừa với tin')))
            if extra:
                result[job.pk] = extra
        return result

    return RankingIntent(
        focus_jobs=job_queryset.filter(focus).distinct() if focus else None,
        bonuses=bonuses,
    )


def preference_intent(job_queryset, preference, cv):
    """Nhu cầu đã khai của ứng viên (có thể chưa khai) và số năm kinh nghiệm của CV."""
    experience = cv.experience_years if cv.experience_years != Job.ExperienceYears.NONE else ''
    if preference is None:
        return ranking_intent(job_queryset, experience_level=experience)
    return ranking_intent(
        job_queryset,
        category_ids=[item.job_category_id for item in preference.desired_specializations.all()],
        position_names=[item.name for item in preference.desired_position_others.all()],
        province_ids=[item.location_id for item in preference.preferred_provinces.all()],
        desired_salary=preference.desired_salary_vnd,
        experience_level=experience or preference.experience_level,
    )
