import {
  GlobalOutlined,
  LinkOutlined,
  StopOutlined,
} from '@ant-design/icons'
import {
  Alert,
  AutoComplete,
  Form,
  Input,
  Radio,
} from 'antd'
import { ANNOUNCEMENT_AUDIENCES } from '@/entities/announcement'
import {
  ANNOUNCEMENT_ROUTE_ACCESS,
  announcementCtaRouteGroups,
  announcementCtaRouteInfo,
  inferAnnouncementCtaMode,
} from '../model/route-catalog'

function filterRouteOption(input, option) {
  return option?.search?.includes(input.toLocaleLowerCase('vi'))
}

function internalRouteRules() {
  return [
    { required: true, message: 'Chọn trang đích cho CTA.' },
    {
      validator: (_, value) => (
        !value || inferAnnouncementCtaMode(value) === 'internal'
          ? Promise.resolve()
          : Promise.reject(new Error('Chọn một trang trong danh mục hoặc nhập đường dẫn bắt đầu bằng /.'))
      ),
    },
  ]
}

export default function AnnouncementCtaFields({ audiences, ctaMode, form, surfaces }) {
  const ctaRoutes = announcementCtaRouteGroups()
  const ctaUrl = Form.useWatch('cta_url', form)
  const selectedRoute = announcementCtaRouteInfo(ctaUrl)
  const crossesPortal = selectedRoute && !surfaces?.includes(selectedRoute.surface)
  const guestMaySee = audiences?.includes(ANNOUNCEMENT_AUDIENCES.GUEST)
  const requiresLogin = selectedRoute?.access === ANNOUNCEMENT_ROUTE_ACCESS.AUTHENTICATED

  const changeCtaMode = (event) => {
    const nextMode = event.target.value
    const previousMode = form.getFieldValue('cta_mode')
    if (nextMode !== previousMode) form.setFieldValue('cta_url', '')
    if (nextMode === 'none') {
      form.setFieldsValue({
        cta_label_vi: '',
        cta_label_en: '',
        cta_url: '',
      })
    }
  }

  return (
    <>
      <Form.Item
        className="announcement-editor__wide"
        name="cta_mode"
        label="Điều hướng khi người dùng bấm CTA"
      >
        <Radio.Group
          className="announcement-editor__cta-mode"
          onChange={changeCtaMode}
          optionType="button"
          buttonStyle="solid"
        >
          <Radio.Button value="none"><StopOutlined /> Không có CTA</Radio.Button>
          <Radio.Button value="internal"><LinkOutlined /> Trang trong hệ thống</Radio.Button>
          <Radio.Button value="external"><GlobalOutlined /> Website bên ngoài</Radio.Button>
        </Radio.Group>
      </Form.Item>
      {ctaMode !== 'none' && (
        <>
          <Form.Item
            name="cta_label_vi"
            label="Nhãn CTA tiếng Việt"
            rules={[{ required: true, whitespace: true, message: 'Nhập nhãn CTA tiếng Việt.' }]}
          >
            <Input maxLength={100} placeholder="Xem chi tiết" />
          </Form.Item>
          <Form.Item name="cta_label_en" label="Nhãn CTA tiếng Anh">
            <Input maxLength={100} placeholder="Fallback về tiếng Việt khi để trống" />
          </Form.Item>
          {ctaMode === 'internal' ? (
            <Form.Item
              className="announcement-editor__wide"
              name="cta_url"
              label="Trang đích trong hệ thống"
              extra="Tìm theo tên trang hoặc đường dẫn. URL được tự điều chỉnh cho local và domain triển khai."
              rules={internalRouteRules()}
            >
              <AutoComplete
                options={ctaRoutes}
                filterOption={filterRouteOption}
                placeholder="Nhập để tìm, ví dụ: việc làm, công ty, cài đặt…"
                popupMatchSelectWidth
              />
            </Form.Item>
          ) : (
            <Form.Item
              className="announcement-editor__wide"
              name="cta_url"
              label="URL website bên ngoài"
              extra="Bắt buộc dùng HTTPS; không chấp nhận URL chứa tài khoản hoặc mật khẩu."
              rules={[
                { required: true, message: 'Nhập URL website bên ngoài.' },
                { type: 'url', message: 'URL chưa đúng định dạng.' },
                { pattern: /^https:\/\//i, message: 'Website bên ngoài bắt buộc dùng HTTPS.' },
              ]}
            >
              <Input maxLength={1000} placeholder="https://status.example.com/thong-bao" />
            </Form.Item>
          )}
          {ctaMode === 'internal' && selectedRoute && (
            <Alert
              className="announcement-editor__wide"
              type={requiresLogin && guestMaySee ? 'warning' : 'info'}
              showIcon
              title={requiresLogin && guestMaySee
                ? 'Một phần người xem sẽ phải đăng nhập'
                : `${selectedRoute.surfaceLabel} · ${requiresLogin ? 'Cần đăng nhập' : 'Công khai'}`}
              description={[
                crossesPortal ? 'CTA sẽ mở sang cổng khác. ' : '',
                requiresLogin && guestMaySee
                  ? 'Thông báo đang cho phép khách chưa đăng nhập, nhưng trang CTA được bảo vệ và sẽ chuyển họ tới đăng nhập.'
                  : 'Nơi hiển thị thông báo và trang đích CTA được cấu hình độc lập.',
              ].join('')}
            />
          )}
        </>
      )}
    </>
  )
}
