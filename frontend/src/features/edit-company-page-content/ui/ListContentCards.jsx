import { DeleteOutlined, PlusOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { Button, Checkbox, Form, Input, Select } from 'antd'
import { getJobBenefits, jobKeys } from '@/entities/job'
import { getProvinces } from '@/entities/location'
import RichTextEditor from '@/shared/ui/RichTextEditor'
import { cardStatus, changedFields, contentValue } from '../model/content-form'
import ContentCard from './ContentCard'

const asList = (data) => (Array.isArray(data) ? data : [])

function BenefitNotes({ form, catalogue }) {
  const ids = Form.useWatch('benefit_ids', form) || []
  return ids.map((id) => {
    const name = catalogue.find((item) => item.id === id)?.name || 'phúc lợi'
    return (
      <Form.Item key={id} name={['benefit_notes', String(id)]} label={`Ghi chú cho "${name}" (không bắt buộc)`}>
        <Input maxLength={160} showCount />
      </Form.Item>
    )
  })
}

export function BenefitsCard({ page, readOnly }) {
  const form = page.content_form
  const limit = page.registry.limits?.benefits ?? 8
  const catalogueQuery = useQuery({ queryKey: jobKeys.benefits, queryFn: getJobBenefits, staleTime: 10 * 60_000 })
  const catalogue = asList(catalogueQuery.data)
  const benefits = (contentValue(form, 'benefits') || []).map(({ benefit_id: id, note }) => ({ benefit_id: id, note: note || '' }))
  const employeeBenefits = contentValue(form, 'employee_benefits') || ''
  const ids = benefits.map((item) => item.benefit_id)

  return (
    <ContentCard
      card="benefits"
      title="Phúc lợi"
      {...cardStatus(page, 'benefits')}
      readOnly={readOnly}
      initialValues={{
        benefit_ids: ids,
        benefit_notes: Object.fromEntries(benefits.map((item) => [String(item.benefit_id), item.note])),
        employee_benefits: employeeBenefits,
      }}
      // Lỗi theo chỉ số của `benefits` gắn vào ô ghi chú của phúc lợi tương ứng.
      errorName={([field, index, ...rest]) => {
        if (field === 'benefits') return typeof index === 'number' && rest[0] === 'note' ? ['benefit_notes', String(ids[index])] : ['benefit_ids']
        return [field, index, ...rest].filter((part) => part !== undefined)
      }}
      toSubmission={(values) => ({
        changes: changedFields(
          {
            benefits: (values.benefit_ids || []).map((id) => ({ benefit_id: id, note: (values.benefit_notes?.[String(id)] || '').trim() })),
            employee_benefits: values.employee_benefits || '',
          },
          { benefits, employee_benefits: employeeBenefits },
        ),
      })}
    >
      {({ form: cardForm, readOnly: locked }) => (
        <>
          <Form.Item name="benefit_ids" label="Phúc lợi nổi bật" extra={`Chọn tối đa ${limit} phúc lợi từ danh mục.`}>
            <Select
              mode="multiple"
              maxCount={limit}
              allowClear
              loading={catalogueQuery.isPending}
              optionFilterProp="label"
              placeholder="Chọn phúc lợi"
              options={catalogue.map((item) => ({ value: item.id, label: item.name }))}
            />
          </Form.Item>
          <BenefitNotes form={cardForm} catalogue={catalogue} />
          <Form.Item name="employee_benefits" label="Mô tả thêm về phúc lợi">
            <RichTextEditor maxLength={10000} disabled={locked} placeholder="Chế độ đãi ngộ, chính sách dành cho nhân viên" />
          </Form.Item>
        </>
      )}
    </ContentCard>
  )
}

const toOffice = (office) => ({
  label: (office?.label || '').trim(),
  address_line: (office?.address_line || '').trim(),
  province_id: office?.province_id ?? null,
  is_headquarters: Boolean(office?.is_headquarters),
})

export function OfficesCard({ page, readOnly }) {
  const limit = page.registry.limits?.offices ?? 10
  const offices = (contentValue(page.content_form, 'offices') || []).map(toOffice)
  const provincesQuery = useQuery({ queryKey: ['locations', 'provinces'], queryFn: getProvinces, staleTime: 10 * 60_000 })
  const provinces = asList(provincesQuery.data).map((item) => ({ value: item.id, label: item.name }))

  return (
    <ContentCard
      card="offices"
      title="Văn phòng"
      {...cardStatus(page, 'offices')}
      readOnly={readOnly}
      initialValues={{ offices }}
      toSubmission={(values) => ({ changes: changedFields({ offices: (values.offices || []).map(toOffice) }, { offices }) })}
    >
      {({ form, readOnly: locked }) => (
        <Form.List name="offices">
          {(fields, { add, remove }) => (
            <div className="company-content-offices">
              {fields.map(({ key, name }) => (
                <fieldset key={key} className="company-content-office">
                  <legend>Văn phòng {name + 1}</legend>
                  <div className="company-content-grid">
                    <Form.Item name={[name, 'label']} label="Tên văn phòng">
                      <Input maxLength={80} placeholder="Ví dụ: Chi nhánh Đà Nẵng" />
                    </Form.Item>
                    <Form.Item name={[name, 'province_id']} label="Tỉnh/thành phố" rules={[{ required: true, message: 'Chọn tỉnh/thành phố.' }]}>
                      <Select showSearch optionFilterProp="label" loading={provincesQuery.isPending} options={provinces} placeholder="Chọn tỉnh/thành phố" />
                    </Form.Item>
                  </div>
                  <Form.Item name={[name, 'address_line']} label="Địa chỉ" rules={[{ required: true, whitespace: true, message: 'Nhập địa chỉ văn phòng.' }]}>
                    <Input maxLength={255} />
                  </Form.Item>
                  <div className="company-content-office__footer">
                    <Form.Item name={[name, 'is_headquarters']} valuePropName="checked" noStyle>
                      {/* Chỉ một trụ sở chính: chọn ô này thì bỏ chọn các văn phòng khác. */}
                      <Checkbox
                        onChange={(event) => event.target.checked && form.setFieldValue(
                          'offices',
                          form.getFieldValue('offices').map((office, index) => ({ ...office, is_headquarters: index === name })),
                        )}
                      >
                        Trụ sở chính
                      </Checkbox>
                    </Form.Item>
                    <Button type="link" danger size="small" icon={<DeleteOutlined aria-hidden="true" />} disabled={locked} onClick={() => remove(name)}>
                      Xoá văn phòng {name + 1}
                    </Button>
                  </div>
                </fieldset>
              ))}
              <Button
                icon={<PlusOutlined aria-hidden="true" />}
                disabled={locked || fields.length >= limit}
                onClick={() => add({ label: '', address_line: '', province_id: undefined, is_headquarters: fields.length === 0 })}
              >
                Thêm văn phòng ({fields.length}/{limit})
              </Button>
            </div>
          )}
        </Form.List>
      )}
    </ContentCard>
  )
}
