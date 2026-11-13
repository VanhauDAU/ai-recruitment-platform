const MANUAL_REVIEW_COPY = {
  missing: 'Chưa có kết quả tra cứu thuế cho phiên hồ sơ này.',
  mismatch: 'Thông tin do nguồn thuế trả về không khớp với hồ sơ nhà tuyển dụng.',
  not_found: 'Nguồn tra cứu không tìm thấy mã số thuế này.',
  unavailable: 'Nguồn tra cứu thuế hiện không phản hồi.',
  invalid_response: 'Phản hồi từ nguồn tra cứu thuế không hợp lệ.',
}

export function getTaxReviewState(evidence) {
  if (!evidence) {
    return {
      status: 'missing',
      blocksApproval: false,
      requiresManualApproval: true,
      message: MANUAL_REVIEW_COPY.missing,
    }
  }

  if (evidence.status === 'pending') {
    return {
      status: 'pending',
      blocksApproval: true,
      requiresManualApproval: false,
      message: 'Đang chờ kết quả tra cứu thuế. Chưa thể duyệt hồ sơ.',
    }
  }

  const comparison = evidence.comparison || {}
  if (
    evidence.status === 'found'
    && comparison.tax_code === 'match'
    && comparison.company_name === 'match'
  ) {
    return {
      status: 'matched',
      blocksApproval: false,
      requiresManualApproval: false,
      message: 'Mã số thuế và tên đăng ký đã khớp.',
    }
  }

  const status = evidence.status === 'found' ? 'mismatch' : evidence.status
  return {
    status,
    blocksApproval: false,
    requiresManualApproval: true,
    message: MANUAL_REVIEW_COPY[status] || MANUAL_REVIEW_COPY.invalid_response,
  }
}
