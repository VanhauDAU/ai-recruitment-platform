import { Button, Result, Skeleton } from 'antd'
import { Link } from 'react-router'
import { KNOWLEDGE_ROOT } from '@/entities/knowledgebase'

export function KnowledgeLoading() {
  return (
    <div className="knowledge-state knowledge-state--loading" aria-label="Đang tải nội dung trợ giúp">
      <Skeleton active paragraph={{ rows: 2 }} />
      <Skeleton active paragraph={{ rows: 5 }} />
      <Skeleton active paragraph={{ rows: 5 }} />
    </div>
  )
}

export function KnowledgeError({ onRetry }) {
  return (
    <div className="knowledge-state">
      <Result
        status="error"
        title="Chưa tải được trung tâm trợ giúp"
        subTitle="Kết nối có thể đang gián đoạn. Nội dung và lựa chọn của bạn vẫn được giữ nguyên."
        extra={<Button type="primary" onClick={onRetry}>Thử lại</Button>}
      />
    </div>
  )
}

export function KnowledgeNotFound({ title = 'Không tìm thấy nội dung trợ giúp' }) {
  return (
    <div className="knowledge-state">
      <Result
        status="404"
        title={title}
        subTitle="Nội dung có thể đã được di chuyển, lưu trữ hoặc chưa được công khai."
        extra={<Link to={KNOWLEDGE_ROOT} className="knowledge-primary-link">Về trung tâm trợ giúp</Link>}
      />
    </div>
  )
}
