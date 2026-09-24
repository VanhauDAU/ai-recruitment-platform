import { MailOutlined, ReloadOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { Alert, Button, Form, Input, Modal, Radio, Select } from 'antd'
import { useEffect } from 'react'
import { JobCategoryTreePicker } from '@/entities/job'
import { getWards } from '@/entities/location'
import {
  JOB_ALERT_EMPLOYMENT_TYPE_OPTIONS,
  JOB_ALERT_EXPERIENCE_OPTIONS,
  JOB_ALERT_FREQUENCY_OPTIONS,
  JOB_ALERT_SALARY_OPTIONS,
  JOB_ALERT_SCOPE_OPTIONS,
  JOB_ALERT_WORK_TYPE_OPTIONS,
  jobAlertFormValues,
  jobAlertPayload,
} from '../model/job-alert-form'

const POPUP_CLASS_NAME = '!rounded-xl !p-1 !shadow-lg [&_.ant-select-item-option]:!rounded-lg'

export default function JobAlertFormModal({
  alert,
  catalogError = false,
  catalogRetrying = false,
  categories,
  categoriesLoading,
  email,
  initialValues,
  onCancel,
  onRetryCatalog,
  onSubmit,
  open,
  provinces,
  provincesLoading,
  saving,
  submitDisabled = false,
}) {
  const [form] = Form.useForm()
  const provinceId = Form.useWatch('province_id', form)
  const frequency = Form.useWatch('frequency', form)
  const editing = Boolean(alert)
  const title = editing ? 'Chỉnh sửa thông báo việc làm' : 'Tạo thông báo việc làm mới'
  const wardsQuery = useQuery({
    queryKey: ['locations', 'wards', provinceId],
    queryFn: () => getWards(provinceId),
    enabled: open && Boolean(provinceId),
    staleTime: 10 * 60 * 1000,
  })

  useEffect(() => {
    if (!open) return
    form.setFieldsValue(jobAlertFormValues(alert || initialValues))
  }, [alert, form, initialValues, open])

  function handleCancel() {
    form.resetFields()
    onCancel()
  }

  return (
    <Modal
      open={open}
      title={<div className="text-center text-lg font-bold text-slate-800">{title}</div>}
      width={720}
      style={{ maxWidth: 'calc(100vw - 20px)', top: 12 }}
      styles={{
        body: { maxHeight: 'calc(100vh - 180px)', overflowY: 'auto' },
        footer: {
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 2.2fr)',
          gap: 12,
        },
      }}
      destroyOnHidden
      mask={{ closable: !saving }}
      closable={!saving}
      onCancel={handleCancel}
      okText={editing ? 'Lưu thay đổi' : 'Tạo thông báo'}
      cancelText="Hủy"
      confirmLoading={saving}
      okButtonProps={{
        htmlType: 'submit',
        form: 'candidate-job-alert-form',
        disabled: submitDisabled || catalogError,
        className: '!m-0 !h-10 !w-full !rounded-md !font-semibold',
      }}
      cancelButtonProps={{
        disabled: saving,
        className: '!m-0 !h-10 !w-full !rounded-md !border-0 !bg-slate-100 !font-semibold',
      }}
    >
      {initialValues?.prefillNotice && (
        <Alert
          showIcon
          type="info"
          className="mb-4"
          title="Kiểm tra lại bộ lọc chọn nhiều giá trị"
          description={initialValues.prefillNotice}
        />
      )}
      {catalogError && (
        <Alert
          showIcon
          type="error"
          className="mb-4"
          title="Không thể tải đầy đủ ngành nghề hoặc địa điểm"
          description="Vui lòng tải lại danh mục trước khi lưu thay đổi."
          action={(
            <Button icon={<ReloadOutlined />} loading={catalogRetrying} onClick={onRetryCatalog}>
              Thử lại
            </Button>
          )}
        />
      )}
      <Form
        id="candidate-job-alert-form"
        form={form}
        layout="vertical"
        requiredMark={(label, { required }) => (
          <span>
            {label}
            {required && <span aria-hidden="true" className="ml-1 font-bold text-red-500">*</span>}
          </span>
        )}
        className="[&_.ant-form-item]:!mb-3 [&_.ant-form-item-explain-error]:!text-xs [&_.ant-form-item-label]:!pb-1.5 [&_.ant-form-item-label>label]:!h-auto [&_.ant-form-item-label>label]:!text-sm [&_.ant-form-item-label>label]:!font-semibold [&_.ant-form-item-label>label]:!text-slate-700"
        onFinish={(values) => onSubmit(jobAlertPayload(values))}
      >
        <Form.Item
          name="keyword"
          label="Từ khóa tìm kiếm"
          required
          rules={[
            { required: true, whitespace: true, message: 'Vui lòng nhập từ khóa việc làm.' },
            { max: 255, message: 'Từ khóa không được dài quá 255 ký tự.' },
          ]}
        >
          <Input allowClear autoFocus placeholder="Ví dụ: Frontend Developer" maxLength={255} />
        </Form.Item>

        <div className="grid gap-x-4 sm:grid-cols-2">
          <Form.Item name="keyword_scope" label="Phạm vi từ khóa">
            <Select options={JOB_ALERT_SCOPE_OPTIONS} classNames={{ popup: { root: POPUP_CLASS_NAME } }} />
          </Form.Item>
          <Form.Item name="category_ids" label="Vị trí chuyên môn">
            <JobCategoryTreePicker
              ariaLabel="Ngành nghề"
              categories={categories}
              disabled={catalogError}
              loading={categoriesLoading}
              showSelectionChips
            />
          </Form.Item>
          <Form.Item name="province_id" label="Tỉnh/Thành phố">
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              loading={provincesLoading}
              disabled={catalogError}
              options={provinces.map((province) => ({ value: province.id, label: province.name }))}
              placeholder="Tất cả tỉnh/thành phố"
              classNames={{ popup: { root: POPUP_CLASS_NAME } }}
              onChange={(value) => {
                form.setFieldValue('province_id', value)
                form.setFieldValue('ward_id', null)
              }}
            />
          </Form.Item>
          <Form.Item name="ward_id" label="Phường/Xã">
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              disabled={!provinceId}
              loading={wardsQuery.isFetching}
              options={(wardsQuery.data || []).map((ward) => ({ value: ward.id, label: ward.name }))}
              placeholder={provinceId ? 'Tất cả phường/xã' : 'Chọn tỉnh/thành trước'}
              classNames={{ popup: { root: POPUP_CLASS_NAME } }}
            />
          </Form.Item>
          <Form.Item name="salary_bucket" label="Mức lương">
            <Select
              allowClear
              options={JOB_ALERT_SALARY_OPTIONS}
              placeholder="Tất cả mức lương"
              classNames={{ popup: { root: POPUP_CLASS_NAME } }}
            />
          </Form.Item>
          <Form.Item name="experience_years" label="Kinh nghiệm">
            <Select
              allowClear
              options={JOB_ALERT_EXPERIENCE_OPTIONS}
              placeholder="Tất cả kinh nghiệm"
              classNames={{ popup: { root: POPUP_CLASS_NAME } }}
            />
          </Form.Item>
          <Form.Item name="work_type" label="Hình thức làm việc">
            <Select
              allowClear
              options={JOB_ALERT_WORK_TYPE_OPTIONS}
              placeholder="Tất cả hình thức"
              classNames={{ popup: { root: POPUP_CLASS_NAME } }}
            />
          </Form.Item>
          <Form.Item name="employment_type" label="Loại hình công việc">
            <Select
              allowClear
              options={JOB_ALERT_EMPLOYMENT_TYPE_OPTIONS}
              placeholder="Tất cả loại hình"
              classNames={{ popup: { root: POPUP_CLASS_NAME } }}
            />
          </Form.Item>
        </div>

        <div className="grid gap-x-4 border-t border-slate-100 pt-3 sm:grid-cols-2">
          <Form.Item
            name="frequency"
            label="Tần suất nhận thông báo"
            extra={frequency === 'weekly'
              ? 'Gửi lúc 08:00 thứ Hai hằng tuần.'
              : 'Gửi lúc 08:00 hằng ngày.'}
          >
            <Radio.Group
              aria-label="Tần suất nhận thông báo"
              options={JOB_ALERT_FREQUENCY_OPTIONS}
              className="flex min-h-8 flex-wrap items-center gap-x-5 gap-y-2"
            />
          </Form.Item>
          <Form.Item label="Email nhận thông báo">
            <Input
              aria-label="Email nhận thông báo"
              prefix={<MailOutlined className="text-slate-400" />}
              value={email || ''}
              readOnly
            />
          </Form.Item>
        </div>

        <p className="rounded-md bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-500">
          Chỉ gửi việc làm mới khớp tiêu chí tới email đăng nhập đã xác thực; địa chỉ này không được chia sẻ với nhà tuyển dụng.
        </p>
      </Form>
    </Modal>
  )
}
