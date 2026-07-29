import { InfoCircleOutlined } from '@ant-design/icons'
import {
  Alert,
  Checkbox,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Select,
  Slider,
} from 'antd'
import {
  ANNOUNCEMENT_DISMISS_MODES,
  ANNOUNCEMENT_KINDS,
} from '@/entities/announcement'
import {
  ANIMATION_OPTIONS,
  AUDIENCE_OPTIONS,
  DISMISS_OPTIONS,
  ICON_OPTIONS,
  KIND_OPTIONS,
  ROLE_OPTIONS,
  SURFACE_OPTIONS,
} from '../model/announcement-options'
import { simulateAnnouncementPriority } from '../model/priority-simulator'
import AnnouncementCtaFields from './AnnouncementCtaFields'
import AnnouncementPreview from './AnnouncementPreview'
import AnnouncementRouteTargetFields from './AnnouncementRouteTargetFields'

function OptionCheckboxes({ options, ...groupProps }) {
  return (
    <Checkbox.Group className="announcement-editor__checkboxes" {...groupProps}>
      {options.map((option) => (
        <Checkbox key={option.value} value={option.value}>{option.label}</Checkbox>
      ))}
    </Checkbox.Group>
  )
}

export function ContentStep({ detail }) {
  return (
    <div className="announcement-editor__grid">
      <Form.Item
        className="announcement-editor__wide"
        name="internal_name"
        label="Tên vận hành"
        extra="Chỉ quản trị viên nhìn thấy. Tên đã tạo được đổi bằng hành động riêng."
        rules={[{ required: true, whitespace: true, message: 'Nhập tên vận hành.' }]}
      >
        <Input
          maxLength={200}
          showCount
          placeholder="Ví dụ: Bảo trì hệ thống 02/08"
          readOnly={Boolean(detail)}
        />
      </Form.Item>
      <Form.Item
        className="announcement-editor__wide"
        name="message_vi"
        label="Nội dung tiếng Việt"
        rules={[{ required: true, whitespace: true, message: 'Nhập nội dung tiếng Việt.' }]}
      >
        <Input.TextArea maxLength={500} showCount autoSize={{ minRows: 3, maxRows: 6 }} />
      </Form.Item>
      <Form.Item name="badge_vi" label="Badge tiếng Việt">
        <Input maxLength={80} showCount placeholder="Mới, Quan trọng…" />
      </Form.Item>
      <Form.Item name="message_en" label="Nội dung tiếng Anh">
        <Input.TextArea
          maxLength={500}
          showCount
          autoSize={{ minRows: 2, maxRows: 5 }}
          placeholder="Để trống sẽ fallback về tiếng Việt"
        />
      </Form.Item>
      <Form.Item name="badge_en" label="Badge tiếng Anh">
        <Input maxLength={80} showCount placeholder="Fallback về tiếng Việt khi để trống" />
      </Form.Item>
    </div>
  )
}

export function TypeStep({ audiences, ctaMode, dismissMode, form, kind, surfaces }) {
  return (
    <div className="announcement-editor__grid">
      <Form.Item name="kind" label="Loại thông tin" rules={[{ required: true }]}>
        <Select options={KIND_OPTIONS} />
      </Form.Item>
      <Form.Item name="icon" label="Biểu tượng"><Select options={ICON_OPTIONS} /></Form.Item>
      <AnnouncementCtaFields
        audiences={audiences}
        ctaMode={ctaMode}
        form={form}
        surfaces={surfaces}
      />
      <Form.Item name="dismiss_mode" label="Khả năng đóng">
        <Select options={DISMISS_OPTIONS} disabled={kind === ANNOUNCEMENT_KINDS.CRITICAL} />
      </Form.Item>
      {dismissMode === ANNOUNCEMENT_DISMISS_MODES.SNOOZE && (
        <Form.Item
          name="snooze_seconds"
          label="Nhắc lại sau (giây)"
          rules={[{ required: true, message: 'Nhập thời gian snooze.' }]}
        >
          <InputNumber min={60} className="w-full" />
        </Form.Item>
      )}
    </div>
  )
}

export function TargetStep({ surfaces }) {
  return (
    <div className="announcement-editor__grid">
      <Form.Item
        className="announcement-editor__wide"
        name="surfaces"
        label="Surface hiển thị"
        rules={[{ required: true, message: 'Chọn ít nhất một surface.' }]}
      >
        <OptionCheckboxes options={SURFACE_OPTIONS} />
      </Form.Item>
      <Form.Item
        className="announcement-editor__wide"
        name="auth_audiences"
        label="Trạng thái đăng nhập"
        rules={[{ required: true, message: 'Chọn ít nhất một audience.' }]}
      >
        <OptionCheckboxes options={AUDIENCE_OPTIONS} />
      </Form.Item>
      <Form.Item
        className="announcement-editor__wide"
        name="roles"
        label="Giới hạn role"
        extra="Để trống để áp dụng cho mọi role phù hợp với surface."
      >
        <OptionCheckboxes options={ROLE_OPTIONS} />
      </Form.Item>
      <AnnouncementRouteTargetFields surfaces={surfaces} />
    </div>
  )
}

export function ScheduleStep({ form, priority }) {
  return (
    <div className="announcement-editor__grid">
      <Form.Item name="priority" hidden><Input /></Form.Item>
      <Form.Item name="starts_at" label="Bắt đầu (Asia/Ho_Chi_Minh)">
        <DatePicker showTime className="w-full" format="DD/MM/YYYY HH:mm" />
      </Form.Item>
      <Form.Item name="ends_at" label="Kết thúc (Asia/Ho_Chi_Minh)">
        <DatePicker showTime className="w-full" format="DD/MM/YYYY HH:mm" />
      </Form.Item>
      <Form.Item label="Priority trong cùng hạng">
        <div className="announcement-editor__priority">
          <Slider
            min={0}
            max={1000}
            marks={{ 0: '0', 500: '500', 1000: '1000' }}
            value={priority}
            onChange={(nextValue) => form.setFieldValue('priority', nextValue)}
          />
          <InputNumber
            min={0}
            max={1000}
            value={priority}
            onChange={(nextValue) => form.setFieldValue('priority', nextValue)}
          />
        </div>
      </Form.Item>
      <Form.Item name="animation" label="Animation"><Select options={ANIMATION_OPTIONS} /></Form.Item>
      <Form.Item name="display_seconds" label="Thời gian mỗi thông báo">
        <InputNumber min={4} max={15} suffix="giây" className="w-full" />
      </Form.Item>
      <Alert
        className="announcement-editor__wide"
        type="info"
        showIcon
        icon={<InfoCircleOutlined />}
        title="Lifecycle lưu ở UTC; giao diện nhập và hiển thị theo Asia/Ho_Chi_Minh."
      />
    </div>
  )
}

export function PreviewStep({ form, announcements }) {
  return (
    <Form.Item noStyle shouldUpdate>
      {() => {
        const values = form.getFieldsValue(true)
        const simulation = simulateAnnouncementPriority(values, announcements)
        return (
          <div className="announcement-editor__preview-grid">
            <AnnouncementPreview values={values} />
            <section className="announcement-simulator" aria-label="Mô phỏng ưu tiên">
              <div className="announcement-simulator__tier">{simulation.tierLabel}</div>
              <h3>Mô phỏng xung đột hiển thị</h3>
              <p>Surface: {simulation.surfaces.join(', ') || 'Chưa chọn'}</p>
              {simulation.messages.map((message) => (
                <Alert key={message} type="info" showIcon title={message} />
              ))}
              {simulation.conflicts.length > 0 ? (
                <div className="announcement-simulator__conflicts">
                  <strong>Thông báo có thể cạnh tranh</strong>
                  {simulation.conflicts.slice(0, 5).map((item) => (
                    <div key={item.public_id}>
                      <span>{item.internal_name}</span>
                      <span>Hạng {item.tier} · {item.priority ?? 0}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <Alert type="success" showIcon title="Không thấy xung đột cùng hoặc cao hơn." />
              )}
            </section>
          </div>
        )
      }}
    </Form.Item>
  )
}
