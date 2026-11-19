import { getLocale, m } from '@/shared/config/i18n'

// Tiếng Việt viết thường nhãn trong câu "Giải thích …"; tiếng Anh giữ nguyên.
export const explainLabel = (label) => m.employer_campaign_explain({
  label: getLocale() === 'vi' ? label.toLowerCase() : label,
})

export const CAMPAIGN_FUNNEL_STAGES = [
  { key: 'submitted', label: m.employer_campaign_stage_submitted(), color: '#f59e0b', dotClass: 'bg-amber-500' },
  { key: 'viewed', label: m.employer_campaign_funnel_viewed(), color: '#0ea5e9', dotClass: 'bg-sky-500' },
  { key: 'shortlisted', label: m.employer_campaign_funnel_shortlisted(), color: '#8b5cf6', dotClass: 'bg-violet-500' },
  { key: 'interviewed', label: m.employer_campaign_funnel_interviewed(), color: '#ec4899', dotClass: 'bg-pink-500' },
  { key: 'accepted', label: m.employer_campaign_funnel_accepted(), color: '#10b981', dotClass: 'bg-emerald-500' },
  { key: 'rejected', label: m.employer_campaign_stage_rejected(), color: '#f43f5e', dotClass: 'bg-rose-500' },
]

export const CAMPAIGN_PERFORMANCE_METRICS = [
  { key: 'impressions', label: m.employer_campaign_perf_impressions(), help: m.employer_campaign_perf_impressions_help() },
  { key: 'views', label: m.employer_campaign_perf_views(), help: m.employer_campaign_perf_views_help() },
  { key: 'applications', label: m.employer_campaign_perf_applications(), help: m.employer_campaign_perf_applications_help() },
  { key: 'view_rate', label: m.employer_campaign_metric_view_rate(), rate: true, help: m.employer_campaign_perf_view_rate_help() },
  { key: 'application_rate', label: m.employer_campaign_metric_application_rate(), rate: true, help: m.employer_campaign_perf_application_rate_help() },
]
