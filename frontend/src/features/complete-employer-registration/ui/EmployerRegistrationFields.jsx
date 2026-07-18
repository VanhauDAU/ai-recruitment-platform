import {
  BankOutlined,
  EnvironmentOutlined,
  PhoneOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { Form, Input, Radio, Select } from 'antd'

const fieldClassName = '!h-12 !rounded-lg !text-base'

export default function EmployerRegistrationFields({ provinces = [], locationsLoading = false }) {
  return (
    <div className="grid gap-x-5 md:grid-cols-2">
      <Form.Item
        name="full_name"
        label="Họ và tên"
        rules={[
          { required: true, message: 'Vui lòng nhập họ và tên' },
          { min: 2, message: 'Họ và tên cần ít nhất 2 ký tự' },
        ]}
      >
        <Input prefix={<UserOutlined className="text-emerald-600" />} placeholder="Nguyễn Minh Anh" className={fieldClassName} />
      </Form.Item>

      <Form.Item name="gender" label="Giới tính" rules={[{ required: true, message: 'Vui lòng chọn giới tính' }]}>
        <Radio.Group className="flex flex-wrap items-center gap-x-5 gap-y-2 py-2">
          <Radio value="male">Nam</Radio>
          <Radio value="female">Nữ</Radio>
          <Radio value="other">Khác</Radio>
        </Radio.Group>
      </Form.Item>

      <Form.Item
        name="contact_phone"
        label="Số điện thoại cá nhân"
        rules={[
          { required: true, message: 'Vui lòng nhập số điện thoại' },
          { pattern: /^(0|\+84)\d{9,10}$/, message: 'Số điện thoại không hợp lệ' },
        ]}
      >
        <Input prefix={<PhoneOutlined className="text-emerald-600" />} inputMode="tel" placeholder="0912 345 678" className={fieldClassName} />
      </Form.Item>

      <Form.Item
        name="company_name"
        label="Tên công ty"
        rules={[
          { required: true, message: 'Vui lòng nhập tên công ty' },
          { min: 2, message: 'Tên công ty cần ít nhất 2 ký tự' },
        ]}
      >
        <Input prefix={<BankOutlined className="text-emerald-600" />} placeholder="Công ty TNHH ABC" className={fieldClassName} />
      </Form.Item>

      <Form.Item
        name="work_location"
        label="Tỉnh/Thành phố làm việc"
        rules={[{ required: true, message: 'Vui lòng chọn tỉnh/thành phố' }]}
        className="md:col-span-2"
      >
        <Select
          showSearch
          loading={locationsLoading}
          optionFilterProp="label"
          placeholder="Chọn tỉnh/thành phố"
          suffixIcon={<EnvironmentOutlined className="text-emerald-600" />}
          options={provinces.map((item) => ({ value: item.id, label: item.name }))}
          className="[&_.ant-select-selector]:!h-12 [&_.ant-select-selector]:!rounded-lg [&_.ant-select-selection-item]:!leading-[46px] [&_.ant-select-selection-placeholder]:!leading-[46px]"
        />
      </Form.Item>
    </div>
  )
}
