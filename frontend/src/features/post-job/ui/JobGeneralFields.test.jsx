import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Form } from 'antd'
import { describe, expect, it } from 'vitest'
import { createJobFormValues } from '../model/job-form-values'
import JobGeneralFields from './JobGeneralFields'

const categories = [{ id: 1, name: 'Công nghệ thông tin', category_type: 'domain' }]

function Fields() {
  const form = Form.useFormInstance()
  return <JobGeneralFields form={form} categories={categories} />
}

const rowOf = (labelText) => screen.getByText(labelText).closest('.ant-form-item')

describe('JobGeneralFields', () => {
  it('chọn nhiều hình thức làm việc thì vẫn hiện 1 mục trước phần "+N"', () => {
    render(
      <Form layout="vertical" initialValues={{ salary_type: 'range', income_display_type: 'income', work_types: ['onsite', 'remote', 'hybrid'] }}>
        <Fields />
      </Form>,
    )

    const tags = [...rowOf('Hình thức làm việc').querySelectorAll('.ant-select-selection-item')]
      .map((el) => el.textContent.trim())

    expect(tags[0]).toBe('Làm việc tại văn phòng / Onsite')
    expect(tags.at(-1)).toContain('+ 2')
  })

  it('hiển thị mức thu nhập có dấu phân cách nghìn nhưng vẫn lưu số nguyên', async () => {
    const user = userEvent.setup()
    const changes = []
    render(
      <Form
        layout="vertical"
        initialValues={{ salary_type: 'range', income_display_type: 'income' }}
        onValuesChange={(changed) => changes.push(changed)}
      >
        <Fields />
      </Form>,
    )

    const input = rowOf('Từ mức').querySelector('input')
    await user.type(input, '15000000')

    expect(input.value).toBe('15.000.000')
    expect(changes.at(-1).salary_min).toBe(15000000)
  })

  it('cho chọn đơn vị tiền tệ cho mức lương', async () => {
    const user = userEvent.setup()
    render(<Form layout="vertical" initialValues={{ salary_type: 'range', income_display_type: 'income', currency: 'VND' }}><Fields /></Form>)

    await user.click(screen.getByLabelText('Đơn vị tiền tệ'))
    await user.click(screen.getByText('USD ($)'))

    expect(screen.getByLabelText('Đơn vị tiền tệ').closest('.ant-select')).toHaveTextContent('USD ($)')
    expect(rowOf('Từ mức')).toHaveTextContent('USD')
  })

  it('chấp nhận nhập riêng mức tối thiểu hoặc tối đa cho khoảng lương', async () => {
    let form
    function FieldsWithForm() {
      form = Form.useFormInstance()
      return <JobGeneralFields form={form} categories={categories} />
    }
    render(<Form layout="vertical" initialValues={{ salary_type: 'range', income_display_type: 'income' }}><FieldsWithForm /></Form>)

    form.setFieldValue('salary_min', 10_000_000)
    await expect(form.validateFields(['salary_min', 'salary_max'])).resolves.toBeDefined()

    form.setFieldsValue({ salary_min: null, salary_max: 30_000_000 })
    await expect(form.validateFields(['salary_min', 'salary_max'])).resolves.toBeDefined()
  })

  it('hiển thị lại cả hai ô khi API trả về lương chỉ có mức tối đa', () => {
    const initialValues = createJobFormValues({
      salary_type: 'up_to',
      salary_min: null,
      salary_max: 7_000_000,
      income_display_type: 'income',
    })

    render(<Form layout="vertical" initialValues={initialValues}><Fields /></Form>)

    expect(rowOf('Từ mức').querySelector('input')).toHaveValue('')
    expect(rowOf('Đến mức').querySelector('input')).toHaveValue('7.000.000')
  })
})
