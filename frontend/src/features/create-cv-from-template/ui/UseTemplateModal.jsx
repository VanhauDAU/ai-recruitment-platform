import { FileTextOutlined, FormOutlined } from '@ant-design/icons'
import { Alert, Form, Input, Modal, Radio, Select, Spin, message } from 'antd'
import { useEffect, useState } from 'react'
import { getCvSampleContents } from '@/entities/cv-template'
import { useSession } from '@/entities/session'
import { createCvFromTemplate } from '../api/create-cv.api'

function errorMessage(error) {
  const detail = error.response?.data?.detail
  if (Array.isArray(detail)) return detail.join(', ')
  return detail || 'Không thể tạo CV lúc này. Vui lòng thử lại.'
}

export default function UseTemplateModal({ template, open, onClose, onCreated, locale = 'vi-VN' }) {
  const [form] = Form.useForm()
  const { user, isAuthenticated } = useSession()
  const [source, setSource] = useState('blank')
  const [samples, setSamples] = useState([])
  const [loadingSamples, setLoadingSamples] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    form.setFieldsValue({ title: template ? `CV ${template.display_name}` : '' })
    setSource('blank')
    setLoadingSamples(true)
    getCvSampleContents(locale)
      .then(setSamples)
      .catch(() => setSamples([]))
      .finally(() => setLoadingSamples(false))
  }, [form, locale, open, template])

  const submit = async () => {
    if (!isAuthenticated || user?.role !== 'candidate') {
      message.warning('Hãy đăng nhập bằng tài khoản ứng viên để tạo CV.')
      return
    }
    if (!user?.email_verified) {
      message.warning('Bạn cần xác thực email trước khi tạo CV.')
      return
    }
    const values = await form.validateFields()
    setSubmitting(true)
    try {
      const cv = await createCvFromTemplate({
        title: values.title,
        template_public_id: template.public_id,
        language: locale,
        ...(source === 'sample' ? { sample_content_public_id: values.sample_content_public_id } : {}),
      })
      message.success('Đã tạo CV. Bạn có thể bắt đầu chỉnh sửa ngay.')
      onCreated?.(cv)
    } catch (error) {
      message.error(errorMessage(error))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      title={template ? `Dùng mẫu “${template.display_name}”` : 'Dùng mẫu CV'}
      open={open}
      onCancel={onClose}
      onOk={submit}
      okText="Tạo CV"
      cancelText="Để sau"
      confirmLoading={submitting}
      destroyOnHidden
    >
      <p className="mb-4 text-sm text-slate-500">Chọn một khởi đầu. Nội dung và bố cục sẽ được lưu vào bản nháp riêng của bạn.</p>
      <Form form={form} layout="vertical" requiredMark={false}>
        <Form.Item label="Tên CV" name="title" rules={[{ required: true, message: 'Nhập tên CV' }]}>
          <Input maxLength={255} />
        </Form.Item>
        <Form.Item label="Cách bắt đầu">
          <Radio.Group value={source} onChange={(event) => setSource(event.target.value)} className="grid w-full grid-cols-2 gap-2">
            <Radio.Button value="blank" className="!flex !h-auto !items-center !justify-center !py-3"><FormOutlined /> Tạo từ đầu</Radio.Button>
            <Radio.Button value="sample" className="!flex !h-auto !items-center !justify-center !py-3"><FileTextOutlined /> Dùng nội dung mẫu</Radio.Button>
          </Radio.Group>
        </Form.Item>
        {source === 'sample' && (
          <Form.Item name="sample_content_public_id" label="Nội dung mẫu" rules={[{ required: true, message: 'Chọn nội dung mẫu' }]}>
            <Select
              loading={loadingSamples}
              notFoundContent={loadingSamples ? <Spin size="small" /> : 'Chưa có nội dung mẫu phù hợp'}
              placeholder="Chọn nội dung mẫu"
              options={samples.map((sample) => ({
                value: sample.public_id,
                label: `${sample.title}${sample.experience_level !== 'unspecified' ? ` · ${sample.experience_level}` : ''}`,
              }))}
            />
          </Form.Item>
        )}
      </Form>
      {!user?.email_verified && isAuthenticated && <Alert type="warning" showIcon message="Cần xác thực email trước khi tạo CV" />}
    </Modal>
  )
}
