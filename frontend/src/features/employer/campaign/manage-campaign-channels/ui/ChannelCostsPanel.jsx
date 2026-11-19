import { DeleteOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, DatePicker, Form, Input, InputNumber, Skeleton } from 'antd'
import dayjs from '@/shared/lib/dayjs'
import {
  addCampaignChannelCost,
  campaignKeys,
  deleteCampaignChannelCost,
  getCampaignChannelCosts,
} from '@/entities/campaign/campaign'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { message } from '@/shared/lib/toast'
import HelpTip from '@/shared/ui/HelpTip'
import { money } from '../lib/channel-kinds'
import { CHANNEL_METRIC_HELP as HELP } from '../lib/metric-help'
import { getIntlLocale, m } from '@/shared/config/i18n'

const KINDS = [
  m.employer_campaign_costs_kind_ads(),
  m.employer_campaign_costs_kind_flyers(),
  m.employer_campaign_costs_kind_posting_fee(),
  m.employer_campaign_costs_kind_poster(),
]
const AMOUNTS = [500_000, 1_000_000, 2_000_000, 5_000_000]
const thousands = (value) => `${value ?? ''}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.')

// Sổ chi phí của kênh: tiền NTD đã trả để quảng bá qua kênh này. ProCV chỉ ghi lại để tính hiệu quả.
export default function ChannelCostsPanel({ campaign, channel, editable }) {
  const [form] = Form.useForm()
  const queryClient = useQueryClient()
  const key = campaignKeys.channelCosts(campaign.public_id, channel.public_id)
  const costsQuery = useQuery({ queryKey: key, queryFn: () => getCampaignChannelCosts(campaign.public_id, channel.public_id) })
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: key })
    queryClient.invalidateQueries({ queryKey: campaignKeys.channels(campaign.public_id) })
    queryClient.invalidateQueries({ queryKey: campaignKeys.channelReport(campaign.public_id) })
  }
  const add = useMutation({
    mutationFn: (values) => addCampaignChannelCost(campaign.public_id, channel.public_id, {
      amount: values.amount,
      incurred_on: values.incurred_on.format('YYYY-MM-DD'),
      note: (values.note || '').trim(),
    }),
    onSuccess: (_, values) => {
      message.success(m.employer_campaign_costs_recorded({ amount: money(values.amount) }))
      form.resetFields()
      refresh()
    },
    onError: (error) => message.error(getApiErrorMessage(error, m.employer_campaign_costs_add_error())),
  })
  const remove = useMutation({
    mutationFn: (costId) => deleteCampaignChannelCost(campaign.public_id, channel.public_id, costId),
    onSuccess: refresh,
    onError: (error) => message.error(getApiErrorMessage(error, m.employer_campaign_costs_delete_error())),
  })
  const spent = Number(channel.cost || 0)
  const perApplication = channel.applications ? spent / channel.applications : null
  const budgetShare = campaign.budget_max ? (spent * 100) / campaign.budget_max : null
  const costs = costsQuery.data || []

  return (
    <div className="ch-costs">
      <p className="ch-section-note">
        {m.employer_campaign_costs_note()}
      </p>

      <dl className="ch-costs__sum">
        <div><dt>{m.employer_campaign_costs_spent()}</dt><dd>{money(spent)}</dd></div>
        <div><dt>{m.employer_campaign_costs_per_application()}<HelpTip label={m.employer_campaign_costs_per_application_help_label()}>{HELP.costPerApplication}</HelpTip></dt><dd>{perApplication == null ? m.employer_campaign_costs_no_applications() : money(Math.round(perApplication))}</dd></div>
        <div>
          <dt>{m.employer_campaign_costs_budget_share()}<HelpTip label={m.employer_campaign_costs_budget_share_help_label()}>{HELP.budgetShare}</HelpTip></dt>
          <dd>{budgetShare == null ? m.employer_campaign_costs_no_budget() : `${budgetShare.toLocaleString(getIntlLocale(), { maximumFractionDigits: 1 })}%`}</dd>
        </div>
      </dl>

      {editable && (
        <Form
          form={form}
          layout="vertical"
          requiredMark={false}
          className="ch-costs__form"
          initialValues={{ incurred_on: dayjs() }}
          onFinish={(values) => add.mutate(values)}
        >
          <h4>{m.employer_campaign_costs_form_title()}</h4>
          <Form.Item label={m.employer_campaign_costs_note_label()} name="note">
            <Input maxLength={255} placeholder={m.employer_campaign_costs_note_placeholder()} />
          </Form.Item>
          <div className="ch-chips" role="group" aria-label={m.employer_campaign_costs_quick_kind_aria()}>
            {KINDS.map((kind) => (
              <button key={kind} type="button" className="ch-chip" onClick={() => form.setFieldValue('note', kind)}>{kind}</button>
            ))}
          </div>
          <div className="ch-costs__row">
            <Form.Item label={m.employer_campaign_costs_amount()} name="amount" rules={[{ required: true, message: m.employer_campaign_costs_amount_required() }]}>
              <InputNumber
                min={1000}
                step={100_000}
                className="!w-full"
                suffix={m.employer_campaign_currency_suffix()}
                formatter={thousands}
                parser={(value) => value.replace(/\D/g, '')}
                placeholder="1.000.000"
              />
            </Form.Item>
            <Form.Item label={m.employer_campaign_costs_date()} name="incurred_on" rules={[{ required: true, message: m.employer_campaign_costs_date_required() }]}>
              <DatePicker format="DD/MM/YYYY" allowClear={false} className="!w-full" disabledDate={(day) => day.isAfter(dayjs(), 'day')} />
            </Form.Item>
          </div>
          <div className="ch-chips" role="group" aria-label={m.employer_campaign_costs_quick_amount_aria()}>
            {AMOUNTS.map((amount) => (
              <button key={amount} type="button" className="ch-chip" onClick={() => form.setFieldValue('amount', amount)}>{money(amount)}</button>
            ))}
          </div>
          <Button type="primary" htmlType="submit" loading={add.isPending}>{m.employer_campaign_costs_submit()}</Button>
        </Form>
      )}

      <section aria-labelledby={`costs-${channel.public_id}`}>
        <h4 id={`costs-${channel.public_id}`}>{m.employer_campaign_costs_list_title()}</h4>
        {costsQuery.isLoading ? <Skeleton active paragraph={{ rows: 2 }} /> : costs.length === 0 ? (
          <p className="ch-section-note">{m.employer_campaign_costs_empty()}</p>
        ) : (
          <ul className="ch-costs__list">
            {costs.map((cost) => (
              <li key={cost.id}>
                <div>
                  <strong>{money(cost.amount)}</strong>
                  <span>{cost.note || m.employer_campaign_costs_no_note()}</span>
                </div>
                <time dateTime={cost.incurred_on}>{dayjs(cost.incurred_on).format('DD/MM/YYYY')}</time>
                {editable && (
                  <Button
                    type="text"
                    size="small"
                    icon={<DeleteOutlined aria-hidden />}
                    aria-label={m.employer_campaign_costs_delete_aria({ amount: money(cost.amount) })}
                    loading={remove.isPending && remove.variables === cost.id}
                    onClick={() => remove.mutate(cost.id)}
                  />
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
