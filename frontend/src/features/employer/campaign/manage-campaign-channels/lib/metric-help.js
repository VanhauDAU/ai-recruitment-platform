import { m } from '@/shared/config/i18n'

// Giải thích các chỉ số của kênh, dùng chung cho bảng so sánh, chi tiết kênh và mục chi phí.
export const CHANNEL_METRIC_HELP = {
  clicks: m.employer_campaign_help_clicks(),
  applications: m.employer_campaign_help_applications(),
  applyRate: m.employer_campaign_help_apply_rate(),
  hires: m.employer_campaign_help_hires(),
  spent: m.employer_campaign_help_spent(),
  costPerApplication: m.employer_campaign_help_cost_per_application(),
  costPerHire: m.employer_campaign_help_cost_per_hire(),
  budgetShare: m.employer_campaign_help_budget_share(),
}
