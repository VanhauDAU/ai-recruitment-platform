import { PlusOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { Alert, Button, DatePicker, Form, Input, InputNumber, Select } from 'antd'
import dayjs from 'dayjs'
import { useEffect } from 'react'
import { getProvinces, getWards } from '@/entities/location'
import RichTextEditor from '@/shared/ui/RichTextEditor'

function JobLocationRow({ field, form, index, onRemove, provinces }) {
  const provinceId = Form.useWatch(['job_locations', field.name, 'province_id'], form)
  const wardsQuery = useQuery({
    queryKey: ['locations', 'wards', provinceId],
    queryFn: () => getWards(provinceId),
    enabled: Boolean(provinceId),
  })

  function changeProvince(value) {
    form.setFieldValue(['job_locations', field.name, 'province_id'], value)
    form.setFieldValue(['job_locations', field.name, 'location'], undefined)
  }

  return (
    <div className="grid gap-x-4 rounded-lg bg-slate-50 p-3 sm:grid-cols-2">
      <Form.Item
        name={[field.name, 'province_id']}
        label={`Tỉnh/thành làm việc ${index + 1}`}
        rules={[{ required: true, message: 'Chọn tỉnh/thành.' }]}
      >
        <Select
          showSearch
          optionFilterProp="label"
          options={provinces.map((item) => ({ value: item.id, label: item.name }))}
          placeholder="Chọn tỉnh/thành"
          onChange={changeProvince}
        />
      </Form.Item>
      <Form.Item
        name={[field.name, 'location']}
        label="Phường/xã"
        rules={[{ required: true, message: 'Chọn phường/xã.' }]}
      >
        <Select
          showSearch
          optionFilterProp="label"
          loading={wardsQuery.isLoading}
          disabled={!provinceId}
          options={(wardsQuery.data || []).map((item) => ({ value: item.id, label: item.name }))}
          placeholder="Chọn phường/xã"
        />
      </Form.Item>
      <Form.Item
        className="sm:col-span-2 !mb-0"
        name={[field.name, 'address_detail']}
        label="Địa chỉ cụ thể"
        rules={[{ required: true, message: 'Nhập địa chỉ cụ thể.' }]}
      >
        <Input
          addonAfter={index > 0 ? <Button type="text" danger onClick={onRemove}>Xóa địa điểm</Button> : null}
          placeholder="Ví dụ: 123 đường Nguyễn Huệ"
        />
      </Form.Item>
    </div>
  )
}

export default function PostJobForm({
  initialValues,
  campaigns = [],
  categories = [],
  postingContext,
  isDraft,
  requiresNewCredit,
  submitLabel,
  submitting,
  onSaveDraft,
  onPublish,
}) {
  const [form] = Form.useForm()
  const provincesQuery = useQuery({ queryKey: ['locations', 'provinces'], queryFn: getProvinces })

  useEffect(() => {
    form.setFieldsValue({
      ...initialValues,
      deadline: initialValues?.deadline ? dayjs(initialValues.deadline) : null,
      category_assignments: initialValues?.category_assignments?.length
        ? initialValues.category_assignments
        : [{ role: 'primary_specialization', sort_order: 0 }],
      job_locations: initialValues?.job_locations?.length
        ? initialValues.job_locations
        : [{ sort_order: 0 }],
    })
  }, [form, initialValues])

  function payload(values) {
    return {
      ...values,
      deadline: values.deadline?.format('YYYY-MM-DD') || null,
      category_assignments: (values.category_assignments || [])
        .filter((item) => item.category)
        .map((item, index) => ({ ...item, role: 'primary_specialization', sort_order: index })),
      job_locations: (values.job_locations || [])
        .filter((item) => item.location && item.address_detail?.trim())
        .map(({ province_id: _provinceId, ...item }, index) => ({ ...item, sort_order: index })),
    }
  }

  return (
    <Form
      form={form}
      layout="vertical"
      initialValues={{ number_of_vacancies: 1, salary_type: 'negotiable' }}
      onFinish={(values) => onPublish(payload(values))}
    >
      {requiresNewCredit && postingContext && !postingContext.job_postable && (
        <Alert
          className="mb-5"
          type="warning"
          showIcon
          title={postingContext.block_reason}
          description={`Còn ${postingContext.free_publish_remain}/${postingContext.free_publish_limit} lượt đăng miễn phí. Mỗi tin gửi sẽ chờ quản trị viên duyệt.`}
        />
      )}
      <div className="grid gap-x-4 lg:grid-cols-2">
        <Form.Item name="title" label="Tiêu đề tin" rules={[{ required: true, message: 'Nhập tiêu đề.' }]}>
          <Input maxLength={255} placeholder="Ví dụ: Kỹ sư phần mềm Backend" />
        </Form.Item>
        <Form.Item name="campaign" label="Chiến dịch">
          <Select
            allowClear
            options={campaigns.map((item) => ({ value: item.public_id, label: item.name }))}
            placeholder="Không gắn chiến dịch"
          />
        </Form.Item>
      </div>
      <Form.Item name="description" label="Mô tả công việc" rules={[{ required: true, message: 'Nhập mô tả công việc.' }]}>
        <RichTextEditor placeholder="Mô tả trách nhiệm, mục tiêu và môi trường làm việc" />
      </Form.Item>
      <Form.Item name="requirements" label="Yêu cầu">
        <RichTextEditor placeholder="Kỹ năng và kinh nghiệm cần có" />
      </Form.Item>
      <Form.Item name="benefits" label="Quyền lợi">
        <RichTextEditor placeholder="Chế độ, phúc lợi và cơ hội phát triển" />
      </Form.Item>
      <div className="grid gap-x-4 lg:grid-cols-2">
        <Form.List name="category_assignments">
          {(fields) => fields.map((field) => (
            <Form.Item
              key={field.key}
              name={[field.name, 'category']}
              label="Vị trí chuyên môn"
              rules={[{ required: true, message: 'Chọn vị trí chuyên môn.' }]}
            >
              <Select
                showSearch
                optionFilterProp="label"
                options={categories.map((item) => ({ value: item.id, label: item.name }))}
              />
            </Form.Item>
          ))}
        </Form.List>
        <Form.Item name="number_of_vacancies" label="Số lượng cần tuyển" rules={[{ required: true, type: 'number', min: 1 }]}>
          <InputNumber min={1} className="!w-full" />
        </Form.Item>
      </div>
      <Form.List name="job_locations">
        {(fields, { add, remove }) => (
          <div className="space-y-3">
            {fields.map((field, index) => (
              <JobLocationRow
                key={field.key}
                field={field}
                form={form}
                index={index}
                onRemove={() => remove(field.name)}
                provinces={provincesQuery.data || []}
              />
            ))}
            <Button type="dashed" icon={<PlusOutlined />} onClick={() => add({ sort_order: fields.length })}>
              Thêm địa điểm làm việc
            </Button>
          </div>
        )}
      </Form.List>
      <div className="mt-5 grid gap-x-4 lg:grid-cols-3">
        <Form.Item name="deadline" label="Hạn nộp" rules={[{ required: true, message: 'Chọn hạn nộp.' }]}>
          <DatePicker className="!w-full" />
        </Form.Item>
        <Form.Item name="employment_type" label="Loại hình">
          <Select
            allowClear
            options={[
              ['full_time', 'Toàn thời gian'],
              ['part_time', 'Bán thời gian'],
              ['internship', 'Thực tập'],
            ].map(([value, label]) => ({ value, label }))}
          />
        </Form.Item>
        <Form.Item name="work_type" label="Hình thức">
          <Select
            allowClear
            options={[
              ['onsite', 'Tại văn phòng'],
              ['remote', 'Từ xa'],
              ['hybrid', 'Linh hoạt'],
            ].map(([value, label]) => ({ value, label }))}
          />
        </Form.Item>
      </div>
      <div className="mt-7 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button loading={submitting} onClick={() => onSaveDraft(payload(form.getFieldsValue(true)))}>
          {isDraft ? 'Lưu nháp' : 'Lưu thay đổi'}
        </Button>
        <Button
          type="primary"
          htmlType="submit"
          loading={submitting}
          disabled={requiresNewCredit && postingContext && !postingContext.job_postable}
        >
          {submitLabel || (isDraft ? 'Gửi duyệt tin' : 'Lưu và cập nhật')}
        </Button>
      </div>
    </Form>
  )
}
