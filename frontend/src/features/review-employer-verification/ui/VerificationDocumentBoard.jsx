import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { HolderOutlined, MoreOutlined, WarningOutlined } from '@ant-design/icons'
import { Button, Dropdown, Empty } from 'antd'
import { useState } from 'react'
import { documentStatusMeta } from '@/entities/admin-employer-verification'

const COLUMNS = [
  { status: 'pending', label: 'Chờ duyệt', acceptsDrop: false },
  { status: 'changes_requested', label: 'Cần bổ sung', acceptsDrop: true },
  { status: 'approved', label: 'Đã duyệt', acceptsDrop: true },
  { status: 'rejected', label: 'Từ chối', acceptsDrop: true },
]

const REVIEW_DECISIONS = COLUMNS.filter((column) => column.acceptsDrop)

function formatDate(value) {
  if (!value) return 'Chưa có ngày nộp'
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value))
}

function DocumentCard({ document, selected, canReview, onSelect, onDecision }) {
  const draggable = useDraggable({
    id: document.public_id,
    data: { document },
    disabled: !canReview,
  })
  const style = {
    transform: CSS.Translate.toString(draggable.transform),
    opacity: draggable.isDragging ? 0.35 : 1,
  }
  const menu = {
    items: REVIEW_DECISIONS
      .filter((column) => column.status !== document.status)
      .map((column) => ({ key: column.status, label: column.label })),
    onClick: ({ key, domEvent }) => {
      domEvent.stopPropagation()
      onDecision(document, key)
    },
  }

  return (
    <article
      ref={draggable.setNodeRef}
      style={style}
      className={`verification-board-card${selected ? ' is-selected' : ''}`}
      aria-label={`${document.doc_type_label}, ${documentStatusMeta(document.status).label}`}
    >
      <div className="verification-board-card__actions">
        {canReview && (
          <button
            type="button"
            className="verification-board-card__drag"
            aria-label={`Kéo ${document.doc_type_label} sang trạng thái khác`}
            title="Kéo sang cột trạng thái khác"
            {...draggable.attributes}
            {...draggable.listeners}
          >
            <HolderOutlined />
          </button>
        )}
        {canReview && menu.items.length > 0 && (
          <Dropdown menu={menu} trigger={['click']}>
            <Button
              type="text"
              size="small"
              icon={<MoreOutlined />}
              aria-label={`Đổi trạng thái ${document.doc_type_label}`}
              onClick={(event) => event.stopPropagation()}
            />
          </Dropdown>
        )}
      </div>
      <button
        type="button"
        className="verification-board-card__content"
        aria-label={`Xem ${document.doc_type_label}`}
        onClick={() => onSelect(document.public_id)}
      >
        <strong>{document.doc_type_label}</strong>
        <span>{document.file_name}</span>
        <small>{`Phiên ${document.version} · ${formatDate(document.created_at)}`}</small>
        {document.duplicate_company_count > 0 && (
          <span className="verification-board-card__warning">
            <WarningOutlined /> Trùng tệp với công ty khác
          </span>
        )}
      </button>
    </article>
  )
}

function DocumentColumn({ column, documents, selectedDocumentId, canReview, onSelect, onDecision }) {
  const droppable = useDroppable({
    id: `document-status:${column.status}`,
    data: { status: column.status },
    disabled: !canReview || !column.acceptsDrop,
  })
  return (
    <section
      ref={droppable.setNodeRef}
      className={`verification-board-column${droppable.isOver ? ' is-over' : ''}`}
      aria-label={`${column.label}, ${documents.length} giấy tờ`}
    >
      <header className="verification-board-column__header">
        <span className={`verification-board-column__dot is-${column.status}`} aria-hidden="true" />
        <strong>{column.label}</strong>
        <span>{documents.length}</span>
      </header>
      <div className="verification-board-column__body">
        {documents.map((document) => (
          <DocumentCard
            key={document.public_id}
            document={document}
            selected={selectedDocumentId === document.public_id}
            canReview={canReview}
            onSelect={onSelect}
            onDecision={onDecision}
          />
        ))}
        {documents.length === 0 && (
          <p className="verification-board-column__empty">
            {column.acceptsDrop && canReview ? 'Thả giấy tờ vào đây' : 'Không có giấy tờ'}
          </p>
        )}
      </div>
    </section>
  )
}

export default function VerificationDocumentBoard({
  documents,
  selectedDocumentId,
  canReview,
  onSelect,
  onDecision,
}) {
  const [activeDocument, setActiveDocument] = useState(null)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  )

  if (!documents.length) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có giấy tờ hiện hành" />
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={({ active }) => setActiveDocument(active.data.current?.document || null)}
      onDragCancel={() => setActiveDocument(null)}
      onDragEnd={({ active, over }) => {
        const document = active.data.current?.document
        const targetStatus = over?.data.current?.status
        setActiveDocument(null)
        if (
          document
          && targetStatus
          && targetStatus !== 'pending'
          && targetStatus !== document.status
        ) {
          onDecision(document, targetStatus)
        }
      }}
    >
      <div className="verification-board" role="region" aria-label="Bảng trạng thái giấy tờ">
        {COLUMNS.map((column) => (
          <DocumentColumn
            key={column.status}
            column={column}
            documents={documents.filter((document) => document.status === column.status)}
            selectedDocumentId={selectedDocumentId}
            canReview={canReview}
            onSelect={onSelect}
            onDecision={onDecision}
          />
        ))}
      </div>
      <DragOverlay dropAnimation={null}>
        {activeDocument && (
          <div className="verification-board-card verification-board-card--overlay">
            <strong>{activeDocument.doc_type_label}</strong>
            <span>{activeDocument.file_name}</span>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}
