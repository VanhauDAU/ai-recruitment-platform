import { DeleteOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, DatePicker, Form, Input, InputNumber, Skeleton } from 'antd'
import dayjs from 'dayjs'
import {
  addCampaignChannelCost,
  campaignKeys,
  deleteCampaignChannelCost,
  getCampaignChannelCosts,
} from '@/entities/campaign'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { message } from '@/shared/lib/toast'
import { money } from '../lib/channel-kinds'

const KINDS = ['Chạy quảng cáo', 'In ấn tờ rơi', 'Phí đăng tin', 'Thuê người đăng']
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
      message.success(`Đã ghi ${money(values.amount)} cho kênh này.`)
      form.resetFields()
      refresh()
    },
    onError: (error) => message.error(getApiErrorMessage(error, 'Không thể ghi khoản chi.')),
  })
  const remove = useMutation({
    mutationFn: (costId) => deleteCampaignChannelCost(campaign.public_id, channel.public_id, costId),
    onSuccess: refresh,
    onError: (error) => message.error(getApiErrorMessage(error, 'Không thể xóa khoản chi.')),
  })
  const spent = Number(channel.cost || 0)
  const perApplication = channel.applications ? spent / channel.applications : null
  const budgetShare = campaign.budget_max ? (spent * 100) / campaign.budget_max : null
  const costs = costsQuery.data || []

  return (
    <div className="ch-costs">
      <p className="ch-section-note">
        Ghi lại tiền bạn đã trả để quảng bá qua kênh này, ví dụ chạy quảng cáo hay in tờ rơi.
        ProCV không thu khoản nào, chỉ dùng số này để tính chi phí cho mỗi hồ sơ và so sánh các kênh.
      </p>

      <dl className="ch-costs__sum">
        <div><dt>Đã chi cho kênh</dt><dd>{money(spent)}</dd></div>
        <div><dt>Chi phí mỗi hồ sơ</dt><dd>{perApplication == null ? 'Chưa có hồ sơ' : money(Math.round(perApplication))}</dd></div>
        <div>
          <dt>Phần ngân sách chiến dịch</dt>
          <dd>{budgetShare == null ? 'Chưa đặt ngân sách' : `${budgetShare.toLocaleString('vi-VN', { maximumFractionDigits: 1 })}%`}</dd>
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
          <h4>Ghi một khoản chi</h4>
          <Form.Item label="Khoản chi cho việc gì" name="note">
            <Input maxLength={255} placeholder="Ví dụ: Quảng cáo Facebook tuần 1" />
          </Form.Item>
          <div className="ch-chips" role="group" aria-label="Chọn nhanh loại chi">
            {KINDS.map((kind) => (
              <button key={kind} type="button" className="ch-chip" onClick={() => form.setFieldValue('note', kind)}>{kind}</button>
            ))}
          </div>
          <div className="ch-costs__row">
            <Form.Item label="Số tiền" name="amount" rules={[{ required: true, message: 'Nhập số tiền đã chi.' }]}>
              <InputNumber
                min={1000}
                step={100_000}
                className="!w-full"
                suffix="đ"
                formatter={thousands}
                parser={(value) => value.replace(/\D/g, '')}
                placeholder="1.000.000"
              />
            </Form.Item>
            <Form.Item label="Ngày chi" name="incurred_on" rules={[{ required: true, message: 'Chọn ngày chi.' }]}>
              <DatePicker format="DD/MM/YYYY" allowClear={false} className="!w-full" disabledDate={(day) => day.isAfter(dayjs(), 'day')} />
            </Form.Item>
          </div>
          <div className="ch-chips" role="group" aria-label="Chọn nhanh số tiền">
            {AMOUNTS.map((amount) => (
              <button key={amount} type="button" className="ch-chip" onClick={() => form.setFieldValue('amount', amount)}>{money(amount)}</button>
            ))}
          </div>
          <Button type="primary" htmlType="submit" loading={add.isPending}>Ghi khoản chi</Button>
        </Form>
      )}

      <section aria-labelledby={`costs-${channel.public_id}`}>
        <h4 id={`costs-${channel.public_id}`}>Các khoản đã ghi</h4>
        {costsQuery.isLoading ? <Skeleton active paragraph={{ rows: 2 }} /> : costs.length === 0 ? (
          <p className="ch-section-note">Chưa có khoản chi nào. Kênh miễn phí thì không cần ghi.</p>
        ) : (
          <ul className="ch-costs__list">
            {costs.map((cost) => (
              <li key={cost.id}>
                <div>
                  <strong>{money(cost.amount)}</strong>
                  <span>{cost.note || 'Không ghi chú'}</span>
                </div>
                <time dateTime={cost.incurred_on}>{dayjs(cost.incurred_on).format('DD/MM/YYYY')}</time>
                {editable && (
                  <Button
                    type="text"
                    size="small"
                    icon={<DeleteOutlined aria-hidden />}
                    aria-label={`Xóa khoản chi ${money(cost.amount)}`}
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
