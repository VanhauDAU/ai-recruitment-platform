import { Button, DatePicker, Form, Input, InputNumber, Modal, Select } from 'antd'
import dayjs from 'dayjs'
import { useState } from 'react'

export default function ApplicationInfoFields({ campaigns, creatingCampaign, onCreateCampaign }) {
  const form = Form.useFormInstance()
  const [quickCreateOpen, setQuickCreateOpen] = useState(false)
  const [quickCreateForm] = Form.useForm()

  async function createQuickCampaign({ name }) {
    const campaign = await onCreateCampaign(name.trim())
    form.setFieldValue('campaign', campaign.public_id)
    quickCreateForm.resetFields()
    setQuickCreateOpen(false)
  }

  return (
    <>
      <div className="grid gap-x-4 md:grid-cols-2">
        <Form.Item name="deadline" label="Hạn nhận hồ sơ" rules={[{ required: true, message: 'Chọn hạn nhận hồ sơ.' }]}>
          <DatePicker className="!w-full" disabledDate={(date) => date && date.isBefore(dayjs().startOf('day'))} format="DD/MM/YYYY" placeholder="-- Chọn hạn nhận hồ sơ --" />
        </Form.Item>
        <Form.Item name="number_of_vacancies" label="Số lượng tuyển" rules={[{ required: true, type: 'number', min: 1, message: 'Số lượng tuyển phải từ 1.' }]}>
          <InputNumber min={1} className="!w-full" placeholder="Nhập số lượng tuyển" />
        </Form.Item>
      </div>
      <Form.Item name="campaign" label="Chiến dịch tuyển dụng">
        <Select
          allowClear
          showSearch
          optionFilterProp="label"
          options={campaigns.map((item) => ({ value: item.public_id, label: item.name }))}
          placeholder="Không gắn chiến dịch"
        />
      </Form.Item>
      <Button type="link" className="!mb-4 !px-0" onClick={() => setQuickCreateOpen(true)}>
        Tạo nhanh chiến dịch mới
      </Button>
      <Modal
        destroyOnHidden
        open={quickCreateOpen}
        title="Tạo nhanh chiến dịch"
        okText="Tạo và chọn"
        cancelText="Hủy"
        confirmLoading={creatingCampaign}
        onCancel={() => setQuickCreateOpen(false)}
        onOk={() => quickCreateForm.submit()}
      >
        <Form form={quickCreateForm} layout="vertical" onFinish={createQuickCampaign}>
          <Form.Item name="name" label="Tên chiến dịch" rules={[{ required: true, whitespace: true, message: 'Nhập tên chiến dịch.' }]}>
            <Input autoFocus maxLength={255} placeholder="Ví dụ: Tuyển đội ngũ kỹ thuật quý III" />
          </Form.Item>
        </Form>
      </Modal>
      <div className="border-t border-slate-200 pt-4">
        <h3 className="text-sm font-extrabold text-slate-800">Người nhận hồ sơ</h3>
        <div className="mt-3 grid gap-x-4 md:grid-cols-2">
          <Form.Item name={['application_contact', 'recipient_name']} label="Họ và tên người nhận" rules={[{ required: true, whitespace: true, message: 'Nhập họ tên người nhận.' }]}>
            <Input maxLength={255} placeholder="Ví dụ: Nguyễn Văn An" />
          </Form.Item>
          <Form.Item
            name={['application_contact', 'phone']}
            label="Số điện thoại"
            rules={[
              { required: true, whitespace: true, message: 'Nhập số điện thoại người nhận.' },
              { pattern: /^[+\d][\d\s().-]{7,29}$/, message: 'Số điện thoại chưa đúng định dạng.' },
            ]}
          >
            <Input maxLength={30} placeholder="Ví dụ: 0912 345 678" />
          </Form.Item>
        </div>
        <Form.Item
          className="!mb-0"
          name={['application_contact', 'emails']}
          label="Email nhận hồ sơ (tối đa 5 email)"
          rules={[
            { required: true, type: 'array', min: 1, message: 'Nhập ít nhất một email nhận hồ sơ.' },
            {
              validator(_, emails = []) {
                if (emails.length > 5) return Promise.reject(new Error('Chỉ được nhập tối đa 5 email.'))
                const valid = emails.every((email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
                return valid ? Promise.resolve() : Promise.reject(new Error('Có email chưa đúng định dạng.'))
              },
            },
          ]}
        >
          <Select mode="tags" tokenSeparators={[',', ' ']} maxCount={5} placeholder="Nhập email rồi nhấn Enter" open={false} />
        </Form.Item>
      </div>
    </>
  )
}
