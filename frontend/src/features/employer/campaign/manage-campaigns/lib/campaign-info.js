import dayjs from '@/shared/lib/dayjs'

const toDay = (value) => (value ? dayjs(value) : null)
const toIso = (value) => (value ? value.format('YYYY-MM-DD') : null)

export function campaignInfoValues(campaign) {
  return {
    name: campaign.name || '',
    description: campaign.description || '',
    landing_intro: campaign.landing_intro || '',
    landing_enabled: campaign.landing_enabled !== false,
    start_date: toDay(campaign.start_date),
    target_date: toDay(campaign.target_date),
    is_continuous: Boolean(campaign.is_continuous),
    budget_min: campaign.budget_min ?? null,
    budget_max: campaign.budget_max ?? null,
    budget_source: campaign.budget_source || 'company',
  }
}

export function campaignInfoPayload(values) {
  return {
    ...values,
    name: values.name.trim(),
    description: (values.description || '').trim(),
    landing_intro: (values.landing_intro || '').trim(),
    start_date: toIso(values.start_date),
    target_date: values.is_continuous ? null : toIso(values.target_date),
  }
}
