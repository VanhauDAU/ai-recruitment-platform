import { DownOutlined } from '@ant-design/icons'
import { useState } from 'react'
import { CampaignChannelBoard, ChannelReport } from '@/features/employer/campaign/manage-campaign-channels'
import { m } from '@/shared/config/i18n'

// Tab "Kênh & nguồn": hai cụm thu gọn, mở cụm này thì cụm kia đóng lại.
// Cụm chỉ dựng (và gọi API) từ lần mở đầu, sau đó giữ lại để co giãn có hiệu ứng.
export default function CampaignChannelsPanel({ campaign }) {
  const [open, setOpen] = useState('channels')
  const [visited, setVisited] = useState(() => new Set(['channels']))
  const toggle = (key) => {
    setOpen((current) => (current === key ? null : key))
    setVisited((current) => (current.has(key) ? current : new Set(current).add(key)))
  }
  const sections = [
    { key: 'channels', title: m.employer_campaign_step_channels(), body: <CampaignChannelBoard campaign={campaign} /> },
    {
      key: 'report',
      title: m.employer_campaign_channels_report_title(),
      body: (
        <>
          <p className="cw-section-intro">{m.employer_campaign_channels_report_intro()}</p>
          <ChannelReport campaignId={campaign.public_id} />
        </>
      ),
    },
  ]

  return (
    <div className="cw-channels">
      {sections.map(({ key, title, body }) => {
        const expanded = open === key
        return (
          <section key={key} className={`cw-fold ${expanded ? 'is-open' : ''}`}>
            <h2 className="cw-fold__title">
              <button
                id={`cw-fold-${key}`}
                type="button"
                aria-expanded={expanded}
                aria-controls={`cw-fold-${key}-body`}
                onClick={() => toggle(key)}
              >
                {title}
                <DownOutlined aria-hidden className="cw-fold__chevron" />
              </button>
            </h2>
            <div
              id={`cw-fold-${key}-body`}
              role="region"
              aria-labelledby={`cw-fold-${key}`}
              className="cw-fold__panel"
              inert={!expanded}
            >
              <div className="cw-fold__clip">
                <div className="cw-fold__body">{visited.has(key) && body}</div>
              </div>
            </div>
          </section>
        )
      })}
    </div>
  )
}
