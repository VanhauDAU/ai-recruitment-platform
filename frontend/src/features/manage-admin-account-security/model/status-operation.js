export function operationTitle(operation) {
  if (operation?.kind === 'sessions') return 'Thu hồi toàn bộ phiên đăng nhập'
  if (operation?.kind === 'resource-hold') return 'Rà soát và gỡ giữ tài nguyên'
  if (operation?.status === 'banned') return 'Cấm tài khoản'
  if (operation?.status === 'inactive' && operation?.beforeStatus === 'banned') {
    return 'Bắt đầu quy trình khôi phục tài khoản bị cấm'
  }
  if (operation?.status === 'inactive') return 'Tạm khóa tài khoản'
  return 'Mở lại tài khoản'
}

export function effectDescription(operation, account) {
  if (operation?.kind === 'sessions') {
    return 'Đăng xuất tài khoản khỏi mọi thiết bị; mật khẩu và dữ liệu không thay đổi.'
  }
  if (operation?.kind === 'resource-hold') {
    return 'Chỉ gỡ lớp policy hold sau rà soát. Tài khoản vẫn tạm khóa và trạng thái gốc của tin/chiến dịch không đổi.'
  }
  if (operation?.status === 'banned') {
    return account.role === 'employer'
      ? 'Tài khoản mất quyền truy cập; mọi tin và chiến dịch chưa kết thúc bị giữ để rà soát. Công ty và recruiter khác không bị ảnh hưởng.'
      : 'Tài khoản mất quyền truy cập; CV và hồ sơ ứng tuyển được giữ nguyên làm bằng chứng, nhà tuyển dụng chỉ còn có thể từ chối hồ sơ.'
  }
  if (operation?.status === 'inactive') {
    return operation?.beforeStatus === 'banned'
      ? 'Đây mới là bước 1. Admin phải rà soát, gỡ giữ tài nguyên rồi mới được mở lại tài khoản.'
      : 'Quyền truy cập bị dừng tạm thời. Trạng thái nghiệp vụ gốc được giữ và sẽ được khôi phục có điều kiện khi mở lại.'
  }
  return 'Tài khoản được đăng nhập lại. Chỉ policy hold tạm thời được gỡ; tài nguyên hết hạn hoặc đã đóng vẫn giữ nguyên.'
}
