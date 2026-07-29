from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from apps.employers.models import RecruitmentCampaign
from apps.jobs.models import Job

from ...models import User


class Command(BaseCommand):
    help = (
        'Đối soát policy hold với trạng thái tài khoản. Mặc định chỉ đọc; '
        'dùng --apply để sửa fail-closed cho tài khoản không hoạt động.'
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--apply',
            action='store_true',
            help='Áp dụng các sửa chữa fail-closed; không tự gỡ hold của tài khoản active.',
        )

    def handle(self, *args, **options):
        apply_changes = options['apply']
        now = timezone.now()
        campaign_nonterminal = [
            RecruitmentCampaign.Status.DRAFT,
            RecruitmentCampaign.Status.ACTIVE,
            RecruitmentCampaign.Status.PAUSED,
        ]
        job_nonterminal = [Job.Status.DRAFT, Job.Status.PENDING, Job.Status.ACTIVE]

        banned_campaigns = RecruitmentCampaign.objects.filter(
            owner__user__status=User.Status.BANNED,
            status__in=campaign_nonterminal,
        ).exclude(policy_hold=RecruitmentCampaign.PolicyHold.BAN_REVIEW)
        banned_jobs = Job.objects.filter(
            posted_by__status=User.Status.BANNED,
            status__in=job_nonterminal,
        ).exclude(policy_hold=Job.PolicyHold.BAN_REVIEW)
        inactive_campaigns = RecruitmentCampaign.objects.filter(
            owner__user__status=User.Status.INACTIVE,
            status__in=campaign_nonterminal,
            policy_hold=RecruitmentCampaign.PolicyHold.NONE,
        )
        inactive_jobs = Job.objects.filter(
            posted_by__status=User.Status.INACTIVE,
            status__in=job_nonterminal,
            policy_hold=Job.PolicyHold.NONE,
        )
        active_campaign_holds = RecruitmentCampaign.objects.filter(
            owner__user__status=User.Status.ACTIVE,
        ).exclude(policy_hold=RecruitmentCampaign.PolicyHold.NONE)
        active_job_holds = Job.objects.filter(
            posted_by__status=User.Status.ACTIVE,
        ).exclude(policy_hold=Job.PolicyHold.NONE)

        counts = {
            'banned_campaign_mismatch': banned_campaigns.count(),
            'banned_job_mismatch': banned_jobs.count(),
            'inactive_campaign_without_hold': inactive_campaigns.count(),
            'inactive_job_without_hold': inactive_jobs.count(),
            'active_campaign_with_hold_manual_review': active_campaign_holds.count(),
            'active_job_with_hold_manual_review': active_job_holds.count(),
        }
        self.stdout.write('Account status hold reconciliation:')
        for key, value in counts.items():
            self.stdout.write(f'- {key}: {value}')

        if not apply_changes:
            self.stdout.write(
                self.style.WARNING(
                    'Read-only: không có dữ liệu nào bị thay đổi. Dùng --apply sau khi duyệt báo cáo.'
                )
            )
            return

        with transaction.atomic():
            repaired = {
                'banned_campaign': banned_campaigns.update(
                    policy_hold=RecruitmentCampaign.PolicyHold.BAN_REVIEW,
                    policy_held_at=now,
                    policy_hold_transition=None,
                ),
                'banned_job': banned_jobs.update(
                    policy_hold=Job.PolicyHold.BAN_REVIEW,
                    policy_held_at=now,
                    policy_hold_transition=None,
                ),
                'inactive_campaign': inactive_campaigns.update(
                    policy_hold=RecruitmentCampaign.PolicyHold.LEGACY_LOCK,
                    policy_held_at=now,
                    policy_hold_transition=None,
                ),
                'inactive_job': inactive_jobs.update(
                    policy_hold=Job.PolicyHold.LEGACY_LOCK,
                    policy_held_at=now,
                    policy_hold_transition=None,
                ),
            }
        for key, value in repaired.items():
            self.stdout.write(self.style.SUCCESS(f'- repaired_{key}: {value}'))
        if (
            counts['active_campaign_with_hold_manual_review']
            or counts['active_job_with_hold_manual_review']
        ):
            self.stdout.write(
                self.style.WARNING(
                    'Hold trên tài khoản active không được tự gỡ; cần xử lý qua workflow quản trị.'
                )
            )
