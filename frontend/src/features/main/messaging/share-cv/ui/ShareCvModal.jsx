import { FileTextOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router'
import { ACCOUNT_ROOT } from '@/entities/account/account'
import { conversationKeys, getShareableCvs, useSendMessage } from '@/entities/messaging/conversation'
import { m } from '@/shared/config/i18n'
import { Button, Dialog, Skeleton } from '@/shared/ui/connect-kit'

/** Pick one saved CV and send it into the conversation (`kind=cv`). */
export default function ShareCvModal({ conversation, onClose }) {
  const { send } = useSendMessage('candidate', conversation.public_id)
  const query = useQuery({ queryKey: conversationKeys.shareableCvs(), queryFn: getShareableCvs })
  const [selectedId, setSelectedId] = useState('')
  const cvs = query.data || []
  const selected = cvs.find((cv) => cv.public_id === selectedId)

  const share = () => {
    if (!selected) return
    send({ kind: 'cv', cv: selected.public_id }, { cv: { title: selected.title, cv_type: selected.cv_type, has_file: false } })
    onClose()
  }

  return (
    <Dialog
      open
      title={m.connect_share_cv_title()}
      onClose={onClose}
      footer={(
        <>
          <Button variant="ink" onClick={onClose}>{m.connect_cancel()}</Button>
          <Button variant="primary" disabled={!selected} onClick={share}>{m.connect_share_send()}</Button>
        </>
      )}
    >
      <p className="pc-dialog__hint">{m.connect_share_cv_hint()}</p>
      {query.isPending && <Skeleton rows={3} />}
      {query.isError && <p className="pc-field__error">{m.connect_share_cv_load_failed()}</p>}
      {query.isSuccess && cvs.length === 0 && (
        <p className="pc-note">
          {m.connect_share_cv_empty()} <Link to={`${ACCOUNT_ROOT}/cv-cua-toi`} className="pc-link">{m.connect_share_cv_manage()}</Link>
        </p>
      )}
      <div className="pc-choices" role="radiogroup" aria-label={m.connect_share_cv_title()}>
        {cvs.map((cv) => (
          <label key={cv.public_id} className="pc-choice">
            <input type="radio" name="share-cv" value={cv.public_id} checked={cv.public_id === selectedId} onChange={() => setSelectedId(cv.public_id)} />
            <span className="pc-card__glyph" aria-hidden><FileTextOutlined /></span>
            <span className="pc-choice__text">
              <span className="pc-choice__title">{cv.title}</span>
              <span className="pc-choice__meta">{cv.cv_type === 'builder' ? m.connect_card_cv_builder() : m.connect_card_cv_uploaded()}</span>
            </span>
          </label>
        ))}
      </div>
    </Dialog>
  )
}
