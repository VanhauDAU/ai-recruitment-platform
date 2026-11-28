"""What each candidate notice says and which channel switches govern it.

Recruiter decisions are mandatory (no switch): a candidate must learn the
outcome of an application. Everything else follows the candidate's choice in
"Cài đặt email & thông báo", per channel.
"""

from dataclasses import dataclass

from ..models import CandidateEmailNotificationSettings, CandidateNotification

Event = CandidateNotification.EventType


@dataclass(frozen=True)
class EventSpec:
    title: str
    message: str
    email_switch: str | None = None  # None: always emailed
    web_switch: str | None = None  # None: always shown in the bell
    email_subject: str = ''  # defaults to the title
    email_template: str = 'application_update'
    action_label: str = 'Xem hồ sơ ứng tuyển'
    # Email gửi thay mặt nhà tuyển dụng: người gửi "<công ty> qua ProCV".
    from_company: bool = True


# Templates only ever receive the company name and job title: internal notes,
# ratings and rejection reasons never leave the recruiter workspace.
EVENTS = {
    Event.APPLICATION_SUBMITTED: EventSpec(
        title='Hồ sơ đã được tiếp nhận',
        message=(
            'Chúc mừng bạn đã ứng tuyển thành công vị trí {job_title} tại {company_name}. '
            'Chúng tôi sẽ báo ngay khi nhà tuyển dụng xem hồ sơ của bạn.'
        ),
        email_switch='application_received_email',
        web_switch='application_received_web',
        email_subject='Chúc mừng bạn đã ứng tuyển thành công vị trí {job_title}',
        email_template='application_received',
        # ProCV xác nhận và gợi ý việc của công ty khác: không đứng tên công ty.
        from_company=False,
    ),
    Event.APPLICATION_VIEWED: EventSpec(
        title='Nhà tuyển dụng đã xem hồ sơ của bạn',
        message='{company_name} đã xem CV bạn ứng tuyển vị trí {job_title}.',
        email_switch='cv_activity_email',
        web_switch='cv_activity_web',
    ),
    Event.APPLICATION_CV_DOWNLOADED: EventSpec(
        title='Nhà tuyển dụng đã tải CV của bạn',
        message='{company_name} đã tải CV bạn nộp cho vị trí {job_title}.',
        email_switch='cv_activity_email',
        web_switch='cv_activity_web',
    ),
    Event.APPLICATION_SHORTLISTED: EventSpec(
        title='Hồ sơ của bạn được đánh giá phù hợp',
        message=(
            '{company_name} đánh giá hồ sơ ứng tuyển vị trí {job_title} của bạn là phù hợp. '
            'Nhà tuyển dụng có thể liên hệ với bạn cho bước tiếp theo.'
        ),
    ),
    Event.APPLICATION_INTERVIEWED: EventSpec(
        title='Bạn được mời phỏng vấn',
        message=(
            '{company_name} mời bạn tham gia phỏng vấn vị trí {job_title}. '
            'Hãy chú ý điện thoại và email để nhận lịch hẹn.'
        ),
    ),
    Event.APPLICATION_ACCEPTED: EventSpec(
        title='Chúc mừng, bạn đã trúng tuyển',
        message='{company_name} thông báo bạn đã trúng tuyển vị trí {job_title}.',
    ),
    Event.APPLICATION_REJECTED: EventSpec(
        title='Kết quả ứng tuyển vị trí {job_title}',
        message=(
            'Cảm ơn bạn đã quan tâm đến vị trí {job_title} tại {company_name}. '
            'Rất tiếc hồ sơ của bạn chưa phù hợp ở thời điểm này. '
            'Chúc bạn sớm tìm được công việc ưng ý.'
        ),
    ),
    Event.TALENT_POOL_SAVED: EventSpec(
        title='Hồ sơ của bạn được lưu vào kho ứng viên tiềm năng',
        message=(
            '{company_name} đã lưu hồ sơ của bạn để liên hệ khi có vị trí phù hợp. '
            'Bạn có thể rút hồ sơ khỏi kho bất cứ lúc nào.'
        ),
        email_switch='cv_activity_email',
        web_switch='cv_activity_web',
        action_label='Quản lý kho hồ sơ của tôi',
    ),
    Event.JOB_INVITATION: EventSpec(
        title='{company_name} mời bạn ứng tuyển',
        message='{company_name} nghĩ bạn phù hợp với vị trí {job_title} và mời bạn ứng tuyển.',
        email_switch='employer_invitation_email',
        web_switch='employer_invitation_web',
        action_label='Xem việc làm và ứng tuyển',
    ),
    Event.CONNECTION_INVITATION: EventSpec(
        title='{company_name} muốn kết nối với bạn',
        message=(
            '{company_name} thấy hồ sơ của bạn phù hợp với vị trí {job_title}. '
            'Đồng ý để nhà tuyển dụng liên hệ trao đổi với bạn, hoặc từ chối nếu chưa phù hợp.'
        ),
        email_switch='employer_invitation_email',
        web_switch='employer_invitation_web',
        action_label='Xem lời mời',
    ),
    # ProCV Connect (ADR-0032): lịch hẹn luôn báo cả email, ứng viên cần xác nhận kịp.
    Event.INTERVIEW_SCHEDULED: EventSpec(
        title='{company_name} mời bạn phỏng vấn',
        message=(
            '{company_name} đã gửi lịch phỏng vấn vị trí {job_title} trong ProCV Connect. '
            'Hãy mở cuộc trò chuyện để nhận lịch, từ chối hoặc đề nghị giờ khác.'
        ),
        action_label='Xem lịch hẹn',
    ),
    Event.INTERVIEW_UPDATED: EventSpec(
        title='Lịch phỏng vấn vị trí {job_title} đã thay đổi',
        message='{company_name} đã cập nhật lịch phỏng vấn vị trí {job_title}.',
        action_label='Xem lịch hẹn',
    ),
    Event.INTERVIEW_REMINDER: EventSpec(
        title='Sắp đến giờ phỏng vấn vị trí {job_title}',
        message='Bạn có lịch phỏng vấn với {company_name} cho vị trí {job_title} sắp diễn ra.',
        action_label='Xem lịch hẹn',
    ),
}


def render_text(template, context):
    return template.format(
        company_name=str(context.get('company_name') or 'Nhà tuyển dụng'),
        job_title=str(context.get('job_title') or ''),
    )


def switch_enabled(user_id, switch):
    """A candidate's channel switch; the model default when never saved."""
    if switch is None:
        return True
    value = (
        CandidateEmailNotificationSettings.objects.filter(candidate_profile__user_id=user_id)
        .values_list(switch, flat=True)
        .first()
    )
    if value is None:
        return CandidateEmailNotificationSettings._meta.get_field(switch).default
    return value
