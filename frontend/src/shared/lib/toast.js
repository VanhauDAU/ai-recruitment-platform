import { toast } from 'sonner'

// Một API thông báo dùng chung cho mọi portal. Giữ tên `message` tương thích
// với các lời gọi hiện có, nhưng render bởi Sonner ngoài mọi layout/overflow.
export const message = toast
