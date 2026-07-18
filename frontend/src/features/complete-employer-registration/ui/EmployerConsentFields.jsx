import { Checkbox, Form } from 'antd'
import { Link } from 'react-router-dom'
import { useSiteSettings } from '@/entities/site-settings'
import { employerMarketingPath } from '@/shared/config/portals'

export default function EmployerConsentFields({ compact = false }) {
  const { siteName } = useSiteSettings()
  return (
    <div className={compact ? 'space-y-3' : 'space-y-3 rounded-xl border border-emerald-100 bg-emerald-50/45 p-4'}>
      {!compact && (
        <p className="text-sm leading-6 text-slate-600">
          Để cung cấp dịch vụ tuyển dụng, {siteName} cần xử lý thông tin tài khoản và doanh nghiệp theo các chính sách dưới đây.
        </p>
      )}
      <Form.Item
        name="terms_accepted"
        valuePropName="checked"
        className="!mb-0"
        rules={[{
          validator: (_, value) => value
            ? Promise.resolve()
            : Promise.reject(new Error('Bạn cần đồng ý với điều khoản bắt buộc')),
        }]}
      >
        <Checkbox className="!items-start">
          <span className="text-sm leading-6 text-slate-700">
            Tôi đã đọc và đồng ý với{' '}
            <Link target="_blank" to={employerMarketingPath('/dieu-khoan-dich-vu')} className="font-semibold !text-emerald-700 hover:underline">Điều khoản dịch vụ</Link>
            {' '}và{' '}
            <Link target="_blank" to={employerMarketingPath('/chinh-sach-quyen-rieng')} className="font-semibold !text-emerald-700 hover:underline">Chính sách quyền riêng tư</Link>.
          </span>
        </Checkbox>
      </Form.Item>
      <Form.Item name="marketing_opt_in" valuePropName="checked" className="!mb-0">
        <Checkbox className="!items-start">
          <span className="text-sm leading-6 text-slate-600">
            Tôi muốn nhận tư vấn về cách tối ưu tin đăng và các giải pháp tuyển dụng phù hợp. Có thể thay đổi lựa chọn này sau.
          </span>
        </Checkbox>
      </Form.Item>
    </div>
  )
}
