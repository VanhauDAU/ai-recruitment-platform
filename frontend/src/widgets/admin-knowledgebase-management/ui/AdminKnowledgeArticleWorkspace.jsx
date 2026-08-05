import { ArrowLeftOutlined, BookOutlined } from '@ant-design/icons'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Button, Skeleton, Space, Tag } from 'antd'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useAdminAccess } from '@/entities/admin-access'
import {
  KNOWLEDGE_LIFECYCLE_STATUS,
  KNOWLEDGE_REVISION_STATUS,
  adminKnowledgeKeys,
  getAdminKnowledgeArticle,
  getAdminKnowledgeCategories,
} from '@/entities/knowledgebase'
import { useSession } from '@/entities/session'
import { KnowledgeRevisionEditor } from '@/features/edit-knowledge-revision'
import { KnowledgePublishActions } from '@/features/publish-knowledge-article'
import { KnowledgeRevisionReview } from '@/features/review-knowledge-revision'
import { adminPath } from '@/shared/config/portals'
import './admin-knowledgebase-management.css'

export default function AdminKnowledgeArticleWorkspace({ publicId }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useSession()
  const access = useAdminAccess(user)
  const [dirty, setDirty] = useState(false)
  const articleQuery = useQuery({
    queryKey: adminKnowledgeKeys.article(publicId),
    queryFn: ({ signal }) => getAdminKnowledgeArticle(publicId, { signal }),
    enabled: Boolean(publicId),
  })
  const categoriesQuery = useQuery({ queryKey: adminKnowledgeKeys.categories, queryFn: getAdminKnowledgeCategories })
  const article = articleQuery.data
  const revisionStatus = KNOWLEDGE_REVISION_STATUS[article?.revisions?.[0]?.status]
  const lifecycle = KNOWLEDGE_LIFECYCLE_STATUS[article?.lifecycle_state]
  const sync = (saved) => queryClient.setQueryData(adminKnowledgeKeys.article(saved.public_id), saved)
  const goBack = () => {
    if (!dirty || window.confirm('Bạn có thay đổi chưa lưu. Rời khỏi trang và giữ bản khôi phục cục bộ?')) navigate(adminPath('/knowledgebase'))
  }

  if (publicId && articleQuery.isLoading) return <div className="knowledge-workspace-loading"><Skeleton active paragraph={{ rows: 12 }} /></div>
  if (publicId && articleQuery.isError) return <Alert type="error" showIcon message="Không thể mở bài viết" description="Bài viết có thể đã bị xóa hoặc bạn không còn quyền truy cập." action={<Button onClick={() => articleQuery.refetch()}>Thử lại</Button>} />

  return (
    <div className="knowledge-article-workspace">
      <header className="knowledge-article-workspace__header">
        <div className="knowledge-article-workspace__identity">
          <Button type="text" aria-label="Quay lại danh sách" icon={<ArrowLeftOutlined />} onClick={goBack} />
          <div className="knowledge-article-workspace__icon"><BookOutlined /></div>
          <div>
            <div className="knowledge-article-workspace__tags">
              <Tag color={revisionStatus?.color}>{revisionStatus?.label || (publicId ? 'Đang tải' : 'Bài mới')}</Tag>
              {article && <Tag color={lifecycle?.color}>{lifecycle?.label}</Tag>}
            </div>
            <h1>{article?.title || 'Tạo nội dung trợ giúp mới'}</h1>
            <p>{article ? `${article.category.name} · revision ${article.revisions?.[0]?.number || 1}` : 'Khởi tạo FAQ hoặc hướng dẫn mới'}</p>
          </div>
        </div>
        <Space wrap>
          <KnowledgePublishActions article={article} canPublish={access.has('knowledgebase.publish')} onArticleChange={sync} disabled={dirty} />
        </Space>
      </header>

      {article && (
        <section className="knowledge-article-workspace__workflow">
          <KnowledgeRevisionReview
            article={article}
            canManage={access.has('knowledgebase.manage')}
            canReview={access.has('knowledgebase.review')}
            onArticleChange={sync}
            disabled={dirty}
          />
        </section>
      )}

      <KnowledgeRevisionEditor
        article={article}
        categories={categoriesQuery.data || []}
        canManage={access.has('knowledgebase.manage')}
        onArticleChange={sync}
        onDirtyChange={setDirty}
      />
    </div>
  )
}
