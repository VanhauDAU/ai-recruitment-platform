// Cửa duy nhất để dùng dayjs: đặt locale toàn cục theo ngôn ngữ giao diện (tên
// tháng/thứ trong DatePicker của antd cũng lấy từ đây). Không import 'dayjs'
// trực tiếp; scripts/check-architecture-rules.mjs chặn việc đó.
import dayjs from 'dayjs'
import 'dayjs/locale/vi'
import { getLocale } from '@/shared/config/i18n'

dayjs.locale(getLocale())

export default dayjs
