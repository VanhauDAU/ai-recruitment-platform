import {
  Alert,
  Form,
  Select,
} from 'antd'
import { useState } from 'react'
import { useMediaQuery } from '@/shared/hooks/use-media-query'
import {
  announcementPrefixRouteGroups,
  isValidAnnouncementPathPrefix,
} from '../model/route-catalog'

function prefixRules(label) {
  return [{
    validator: (_, values = []) => {
      const invalid = values.find((value) => !isValidAnnouncementPathPrefix(value))
      return invalid
        ? Promise.reject(new Error(`${label} "${invalid}" không hợp lệ.`))
        : Promise.resolve()
    },
  }]
}

function PrefixSelect({ options, placeholder, ...selectProps }) {
  const compact = useMediaQuery('(max-width: 640px)')
  const [open, setOpen] = useState(false)

  return (
    <Select
      {...selectProps}
      mode="tags"
      options={options}
      optionFilterProp="label"
      placeholder={placeholder}
      tokenSeparators={[',', '\n']}
      maxTagCount="responsive"
      allowClear
      open={open}
      onOpenChange={setOpen}
      onSelect={() => {
        if (compact) setOpen(false)
      }}
    />
  )
}

export default function AnnouncementRouteTargetFields({ surfaces }) {
  const prefixRoutes = announcementPrefixRouteGroups(surfaces)

  return (
    <>
      <Form.Item
        className="announcement-editor__wide"
        name="include_path_prefixes"
        label="Chỉ hiển thị tại các nhóm trang"
        extra="Để trống = mọi trang thuộc surface đã chọn. Có thể tìm, chọn nhiều hoặc gõ prefix tùy chỉnh rồi nhấn Enter."
        rules={prefixRules('Prefix chỉ hiển thị')}
      >
        <PrefixSelect
          options={prefixRoutes}
          placeholder="Ví dụ: Danh sách việc làm, Cài đặt tài khoản…"
        />
      </Form.Item>
      <Form.Item
        className="announcement-editor__wide"
        name="exclude_path_prefixes"
        label="Không hiển thị tại các nhóm trang"
        extra="Danh sách loại trừ luôn được ưu tiên sau danh sách phía trên. Có thể gõ prefix tùy chỉnh rồi nhấn Enter."
        rules={prefixRules('Prefix loại trừ')}
      >
        <PrefixSelect
          options={prefixRoutes}
          placeholder="Ví dụ: Đăng nhập, Xác thực email…"
        />
      </Form.Item>
      <Alert
        className="announcement-editor__wide"
        type="info"
        showIcon
        title="Cách áp dụng route"
        description="Surface giới hạn đúng cổng. Route “chỉ hiển thị” thu hẹp phạm vi trong cổng đó; route “không hiển thị” luôn thắng nếu cùng khớp."
      />
    </>
  )
}
