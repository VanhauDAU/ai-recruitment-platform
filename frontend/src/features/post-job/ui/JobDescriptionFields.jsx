import { DownOutlined, MinusCircleFilled } from '@ant-design/icons'
import { Button, Form } from 'antd'
import { useState } from 'react'
import RichTextEditor from '@/shared/ui/RichTextEditor'
import JobLocationFields from './JobLocationFields'
import JobScheduleFields from './JobScheduleFields'

const contentRule = (message) => ({
  validator(_, value) {
    const text = String(value || '').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim()
    return text ? Promise.resolve() : Promise.reject(new Error(message))
  },
})

// Chỉ để đăng ký benefit_ids vào form store; các nút chọn bên dưới ghi giá trị qua form.setFieldValue.
function BenefitIdsField() {
  return null
}

export default function JobDescriptionFields({ form, provinces, benefits }) {
  const selectedBenefitIds = Form.useWatch('benefit_ids', form) || []
  const [showAdditionalBenefits, setShowAdditionalBenefits] = useState(selectedBenefitIds.length > 0)
  const benefitGroups = [
    { key: 'allowance', label: 'Phụ cấp' },
    { key: 'equipment', label: 'Hỗ trợ thiết bị làm việc' },
    { key: 'welfare', label: 'Phúc lợi' },
  ].map((group) => ({
    ...group,
    options: benefits
      .filter((item) => item.category === group.key)
      .map((item) => ({ value: item.id, label: item.name })),
  })).filter((group) => group.options.length)

  function toggleBenefit(benefitId) {
    const nextIds = selectedBenefitIds.includes(benefitId)
      ? selectedBenefitIds.filter((id) => id !== benefitId)
      : [...selectedBenefitIds, benefitId]
    form.setFieldValue('benefit_ids', nextIds)
  }
  return (
    <>
      <Form.Item
        name="description"
        label="Mô tả công việc"
        validateTrigger="onChange"
        rules={[contentRule('Nhập mô tả công việc.')]}
      >
        <RichTextEditor contentClassName="post-job-rich-editor__content" minHeight={230} placeholder="Trách nhiệm chính, mục tiêu công việc và phạm vi phụ trách" />
      </Form.Item>
      <Form.Item
        name="requirements"
        label="Yêu cầu ứng viên"
        validateTrigger="onChange"
        rules={[contentRule('Nhập yêu cầu ứng viên.')]}
      >
        <RichTextEditor contentClassName="post-job-rich-editor__content" minHeight={230} placeholder="Kinh nghiệm, kiến thức và năng lực cần có" />
      </Form.Item>
      <Form.Item
        name="benefits"
        label="Quyền lợi"
        validateTrigger="onChange"
        rules={[contentRule('Nhập quyền lợi dành cho ứng viên.')]}
      >
        <RichTextEditor contentClassName="post-job-rich-editor__content" minHeight={230} placeholder="Thu nhập, chế độ, phúc lợi và cơ hội phát triển" />
      </Form.Item>
      <div className="mb-6 rounded-xl border border-emerald-200 bg-white p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="font-semibold text-slate-800">Quyền lợi bổ sung</div>
            <p className="mt-1 text-sm text-slate-700">Thông tin giúp tin tuyển dụng của bạn cạnh tranh hơn so với đối thủ. Quyền lợi hấp dẫn có thể <strong>tăng tỷ lệ ứng tuyển lên đến 30%.</strong></p>
          </div>
          <Button
            type="link"
            className="!h-auto !self-start !p-0"
            icon={showAdditionalBenefits ? <MinusCircleFilled /> : <DownOutlined />}
            onClick={() => setShowAdditionalBenefits((current) => !current)}
          >
            <span>{showAdditionalBenefits ? 'Thu gọn' : 'Thêm thông tin'}</span>
            <span className="ml-1 inline-flex min-w-5 items-center justify-center rounded-full bg-emerald-100 px-1.5 py-0.5 text-xs font-semibold text-emerald-600">
              {selectedBenefitIds.length}
            </span>
          </Button>
        </div>
        {/* Field phải nằm ngoài khối thu gọn: nếu unmount theo panel thì benefit_ids rời khỏi store và số đã chọn về 0. */}
        <Form.Item name="benefit_ids" noStyle><BenefitIdsField /></Form.Item>
        {showAdditionalBenefits && (
          <div className="mt-3">
            {benefitGroups.map((group) => (
              <section
                key={group.key}
                className="grid gap-3 border-t border-slate-100 py-4 first:border-t-0 sm:grid-cols-[180px_minmax(0,1fr)] sm:py-5"
              >
                <h4 className="font-semibold text-slate-700">{group.label}</h4>
                <div className="flex flex-wrap gap-2">
                  {group.options.map((option) => {
                    const selected = selectedBenefitIds.includes(option.value)
                    return (
                      <button
                        key={option.value}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => toggleBenefit(option.value)}
                        className={`cursor-pointer rounded-full border px-3 py-1 text-sm transition-colors ${selected
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-600'
                          : 'border-transparent bg-slate-100 text-slate-600 hover:border-emerald-500 hover:bg-emerald-50 hover:text-emerald-600'
                        }`}
                      >
                        {option.label}
                      </button>
                    )
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
      <div className="mb-2 text-sm font-semibold text-slate-700">Khu vực làm việc <span className="text-red-500">*</span></div>
      <JobLocationFields form={form} provinces={provinces} />
      <JobScheduleFields />
    </>
  )
}
