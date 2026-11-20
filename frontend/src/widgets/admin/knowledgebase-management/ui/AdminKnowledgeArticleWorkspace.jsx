import { ArrowLeftOutlined, BookOutlined } from '@ant-design/icons'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Button, Skeleton, Space, Tag } from 'antd'
import { useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import {
  adminKnowledgeKeys,
  getAdminKnowledgeArticle,
  getAdminKnowledgeCategories,
  knowledgeArticleState,
} from '@/entities/content/knowledgebase'
import { KnowledgeRevisionEditor } from '@/features/admin/content/edit-knowledge-revision'
import { KnowledgePublishActions, KnowledgeRevisionHistory } from '@/features/admin/content/publish-knowledge-article'
import { adminPath } from '@/shared/config/portals'
import useConfirmAction from '@/shared/ui/confirm-action/use-confirm-action'
import './admin-knowledgebase-management.css'

export default function AdminKnowledgeArticleWorkspace({ publicId }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { confirmationModal, requestConfirmation } = useConfirmAction()
  const [dirty, setDirty] = useState(false)
  const editorRef = useRef(null)
  const articleQuery = useQuery({
    queryKey: adminKnowledgeKeys.article(publicId),
    queryFn: ({ signal }) => getAdminKnowledgeArticle(publicId, { signal }),
    enabled: Boolean(publicId),
  })
  const categoriesQuery = useQuery({ queryKey: adminKnowledgeKeys.categories, queryFn: getAdminKnowledgeCategories })
  const article = articleQuery.data
  const stateTags = knowledgeArticleState(article)
  const sync = (saved) => queryClient.setQueryData(adminKnowledgeKeys.article(saved.public_id), saved)
  const goBack = () => {
    if (!dirty) {
      navigate(adminPath('/knowledgebase'))
      return
    }
    requestConfirmation({
      cancelText: 'Ở lại',
      confirmText: 'Rời khỏi trang',
      danger: true,
      description: 'Bạn có chắc muốn rời khỏi trang khi vẫn còn thay đổi chưa lưu? Bản khôi phục cục bộ sẽ được giữ để bạn có thể tiếp tục sau.',
      onConfirm: () => navigate(adminPath('/knowledgebase')),
      title: 'Rời khỏi trình soạn thảo',
    })
  }

  if (publicId && articleQuery.isLoading) return <div className="knowledge-workspace-loading"><Skeleton active paragraph={{ rows: 12 }} /></div>
  if (publicId && articleQuery.isError) return <Alert type="error" showIcon message="Không thể mở bài viết" description="Bài viết có thể đã bị xóa hoặc bạn không còn quyền truy cập." action={<Button onClick={() => articleQuery.refetch()}>Thử lại</Button>} />

  return (
    <>
      <div className="knowledge-article-workspace">
      <header className="knowledge-article-workspace__header">
        <div className="knowledge-article-workspace__identity">
          <Button type="text" aria-label="Quay lại danh sách" icon={<ArrowLeftOutlined />} onClick={goBack} />
          <div className="knowledge-article-workspace__icon"><BookOutlined /></div>
          <div>
            <div className="knowledge-article-workspace__tags">
              {article
                ? stateTags.map((tag) => <Tag key={tag.label} color={tag.color}>{tag.label}</Tag>)
                : <Tag>Bài mới</Tag>}
            </div>
            <h1>{article?.title || 'Tạo nội dung trợ giúp mới'}</h1>
            <p>{article ? article.category.name : 'Khởi tạo FAQ hoặc hướng dẫn mới'}</p>
          </div>
        </div>
        <Space wrap>
          <KnowledgePublishActions
            article={article}
            onArticleChange={sync}
            dirty={dirty}
            prepare={() => editorRef.current?.saveDraft()}
          />
        </Space>
      </header>

      {article && (
        <section className="knowledge-article-workspace__workflow">
          <KnowledgeRevisionHistory article={article} onArticleChange={sync} disabled={dirty} />
        </section>
      )}

      <KnowledgeRevisionEditor
        ref={editorRef}
        article={article}
        categories={categoriesQuery.data || []}
        onArticleChange={sync}
        onDirtyChange={setDirty}
      />
      </div>
      {confirmationModal}
    </>
  )
}
