import { FileTextOutlined, SearchOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { conversationKeys, getShareableJobs, useSendMessage } from '@/entities/messaging/conversation'
import { m } from '@/shared/config/i18n'
import { Button, Dialog, Skeleton } from '@/shared/ui/connect-kit'

/** Pick one of the company's public jobs and send it as a job card (`kind=job`). */
export default function ShareJobModal({ conversation, onClose }) {
  const { send } = useSendMessage('employer', conversation.public_id)
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState('')
  const query = useQuery({ queryKey: conversationKeys.shareableJobs(), queryFn: getShareableJobs })
  const keyword = search.trim().toLocaleLowerCase()
  const allJobs = query.data || []
  const jobs = allJobs.filter((job) => !keyword || job.title.toLocaleLowerCase().includes(keyword))
  const selected = allJobs.find((job) => job.public_id === selectedId)

  const share = () => {
    if (!selected) return
    send({ kind: 'job', job: selected.public_id }, { job: { public_id: selected.public_id, title: selected.title, slug: selected.slug } })
    onClose()
  }

  return (
    <Dialog
      open
      title={m.connect_share_job_title()}
      onClose={onClose}
      footer={(
        <>
          <Button variant="ink" onClick={onClose}>{m.connect_cancel()}</Button>
          <Button variant="primary" disabled={!selected} onClick={share}>{m.connect_share_send()}</Button>
        </>
      )}
    >
      <label className="pc-search">
        <SearchOutlined aria-hidden className="pc-search__icon" />
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={m.connect_share_job_search()}
          aria-label={m.connect_share_job_search()}
          className="pc-search__input"
        />
      </label>
      {query.isPending && <Skeleton rows={3} />}
      {query.isError && <p className="pc-field__error">{m.connect_share_job_load_failed()}</p>}
      {query.isSuccess && jobs.length === 0 && <p className="pc-note">{m.connect_share_job_empty()}</p>}
      <div className="pc-choices" role="radiogroup" aria-label={m.connect_share_job_title()}>
        {jobs.map((job) => (
          <label key={job.public_id} className="pc-choice">
            <input type="radio" name="share-job" value={job.public_id} checked={job.public_id === selectedId} onChange={() => setSelectedId(job.public_id)} />
            <span className="pc-card__glyph" aria-hidden><FileTextOutlined /></span>
            <span className="pc-choice__text"><span className="pc-choice__title">{job.title}</span></span>
          </label>
        ))}
      </div>
    </Dialog>
  )
}
