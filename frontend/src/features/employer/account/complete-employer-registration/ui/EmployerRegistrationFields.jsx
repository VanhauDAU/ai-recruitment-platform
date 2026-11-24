import {
  EnvironmentOutlined,
  PhoneOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { Form, Input, Radio, Select } from 'antd'
import { m } from '@/shared/config/i18n'

const fieldClassName = '!h-12 !rounded-lg !text-base'

export default function EmployerRegistrationFields({ provinces = [], locationsLoading = false }) {
  return (
    <div className="grid gap-x-5 md:grid-cols-2">
      <Form.Item
        name="full_name"
        label={m.employer_account_info_full_name()}
        rules={[
          { required: true, message: m.employer_account_reg_fields_full_name_required() },
          { min: 2, message: m.employer_account_reg_fields_full_name_min() },
        ]}
      >
        <Input autoFocus prefix={<UserOutlined className="text-[var(--brand-primary)]" />} placeholder={m.employer_account_reg_fields_full_name_placeholder()} className={fieldClassName} />
      </Form.Item>

      <Form.Item name="gender" label={m.employer_account_info_gender()} rules={[{ required: true, message: m.employer_account_reg_fields_gender_required() }]}>
        <Radio.Group className="flex flex-wrap items-center gap-x-5 gap-y-2 py-2">
          <Radio value="male">{m.employer_account_info_gender_male()}</Radio>
          <Radio value="female">{m.employer_account_info_gender_female()}</Radio>
          <Radio value="other">{m.employer_account_need_topic_other()}</Radio>
        </Radio.Group>
      </Form.Item>

      <Form.Item
        name="contact_phone"
        label={m.employer_account_reg_fields_phone()}
        rules={[
          { required: true, message: m.employer_account_reg_fields_phone_required() },
          { pattern: /^(0|\+84)\d{9,10}$/, message: m.employer_account_reg_fields_phone_invalid() },
        ]}
      >
        <Input prefix={<PhoneOutlined className="text-[var(--brand-primary)]" />} inputMode="tel" placeholder="0912 345 678" className={fieldClassName} />
      </Form.Item>

      <Form.Item
        name="work_location"
        label={m.employer_account_reg_fields_location()}
        rules={[{ required: true, message: m.employer_account_reg_fields_location_required() }]}
        className="md:col-span-2"
      >
        <Select
          showSearch
          loading={locationsLoading}
          optionFilterProp="label"
          placeholder={m.employer_account_reg_fields_location_placeholder()}
          suffixIcon={<EnvironmentOutlined className="text-[var(--brand-primary)]" />}
          options={provinces.map((item) => ({ value: item.id, label: item.name }))}
          className="[&_.ant-select-selector]:!h-12 [&_.ant-select-selector]:!rounded-lg [&_.ant-select-selection-item]:!leading-[46px] [&_.ant-select-selection-placeholder]:!leading-[46px]"
        />
      </Form.Item>
    </div>
  )
}
