// Locale antd theo ngôn ngữ giao diện. Đổi ngôn ngữ luôn tải lại trang nên chỉ
// chọn một lần lúc khởi động. en_US là locale mặc định có sẵn trong antd
// (undefined = dùng mặc định), chỉ phải nạp thêm bản tiếng Việt. Dùng bản ESM
// (`antd/es`): `antd/locale` trỏ sang bản CommonJS, kéo thêm locale trùng lặp.
import viVN from 'antd/es/locale/vi_VN'
import { getLocale } from '@/shared/config/i18n'

export const antdLocale = getLocale() === 'vi' ? viVN : undefined
