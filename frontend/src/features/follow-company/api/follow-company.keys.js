// SessionProvider xoá toàn bộ cache khi phiên kết thúc nên key không cần gắn theo ứng viên.
export const followCompanyKeys = {
  status: (publicId) => ['company-follow', 'status', publicId],
  followedLists: ['company-follow', 'followed'],
  followedList: (page) => ['company-follow', 'followed', { page }],
}
