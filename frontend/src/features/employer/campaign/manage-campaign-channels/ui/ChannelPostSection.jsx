import { CopyOutlined, EditOutlined, RobotOutlined } from '@ant-design/icons'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button, Checkbox, Input, Radio } from 'antd'
import { useState } from 'react'
import { campaignKeys, generateCampaignChannelContent, updateCampaignChannel } from '@/entities/campaign/campaign'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { m } from '@/shared/config/i18n'
import { message } from '@/shared/lib/toast'
import { copyText, postText } from '../lib/channel-kinds'
import ChannelFacebookPosts from './ChannelFacebookPosts'
import SocialPostPreview from './SocialPostPreview'

const FALLBACK_NOTES = {
  ai_disabled: m.employer_campaign_content_ai_disabled(),
  ai_failed: m.employer_campaign_content_ai_failed(),
}

const TARGETS = [
  { value: 'landing', label: m.employer_campaign_post_target_landing(), hint: m.employer_campaign_post_target_landing_hint() },
  { value: 'job', label: m.employer_campaign_post_target_job(), hint: m.employer_campaign_post_target_job_hint() },
  { value: 'company', label: m.employer_campaign_post_target_company(), hint: m.employer_campaign_post_target_company_hint() },
]

// Bài đăng gồm tin nào và link trong bài dẫn tới đâu; một kênh đăng được nhiều bài khác nhau.
function PostScope({ channel, jobs, target, editable, onChange }) {
  const campaignJobs = channel.links.filter((link) => link.key !== 'landing' && link.key !== 'company')
  const toggle = (jobId) => onChange({ jobs: jobs.includes(jobId) ? jobs.filter((id) => id !== jobId) : [...jobs, jobId] })

  return (
    <div className="ch-scope">
      <div className="ch-scope__row">
        <span className="ch-scope__label" id={`scope-jobs-${channel.public_id}`}>{m.employer_campaign_post_jobs()}</span>
        {campaignJobs.length ? (
          <div className="ch-chips" role="group" aria-labelledby={`scope-jobs-${channel.public_id}`}>
            {campaignJobs.map((job) => (
              <button key={job.key} type="button" className={`ch-chip ${jobs.includes(job.key) ? 'is-on' : ''}`} aria-pressed={jobs.includes(job.key)} disabled={!editable} onClick={() => toggle(job.key)}>
                {job.label}
              </button>
            ))}
          </div>
        ) : <p className="ch-section-note">{m.employer_campaign_post_no_jobs()}</p>}
        {campaignJobs.length > 0 && !jobs.length && <p className="ch-section-note">{m.employer_campaign_post_jobs_default()}</p>}
      </div>
      <div className="ch-scope__row">
        <span className="ch-scope__label" id={`scope-target-${channel.public_id}`}>{m.employer_campaign_post_target()}</span>
        <Radio.Group
          className="ch-scope__targets"
          aria-labelledby={`scope-target-${channel.public_id}`}
          options={TARGETS.map(({ value, label }) => ({ value, label }))}
          value={target}
          disabled={!editable}
          onChange={(event) => onChange({ target: event.target.value })}
        />
        <p className="ch-section-note">{TARGETS.find((item) => item.value === target)?.hint}</p>
      </div>
    </div>
  )
}

function Step({ index, title, children }) {
  return (
    <li className="ch-step">
      <h4 className="ch-step__title"><span aria-hidden>{index}</span>{title}</h4>
      {children}
    </li>
  )
}

// Bài đăng của kênh theo ba bước: chọn tin và link, soạn nội dung, đăng. Bước đăng
// đổi theo kênh: Fanpage do ProCV đăng thay, kênh khác sao chép rồi tự đăng.
export default function ChannelPostSection({ campaign, channel, editable, onEditContent }) {
  const queryClient = useQueryClient()
  const [postedUrl, setPostedUrl] = useState(channel.posted_url || '')
  const [scopeChanged, setScopeChanged] = useState(false)
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: campaignKeys.channels(campaign.public_id) })
    queryClient.invalidateQueries({ queryKey: campaignKeys.channelReport(campaign.public_id) })
  }
  const onError = (fallback) => (error) => message.error(getApiErrorMessage(error, fallback))
  const generate = useMutation({
    mutationFn: () => generateCampaignChannelContent(campaign.public_id, channel.public_id),
    onSuccess: (data) => {
      refresh()
      setScopeChanged(false)
      message[data.fallback_reason ? 'info' : 'success'](
        FALLBACK_NOTES[data.fallback_reason] || m.employer_campaign_content_ai_done(),
      )
    },
    onError: onError(m.employer_campaign_content_generate_error()),
  })
  const update = useMutation({
    mutationFn: (payload) => updateCampaignChannel(campaign.public_id, channel.public_id, payload),
    onSuccess: (_, payload) => {
      refresh()
      if ('jobs' in payload || 'target' in payload) setScopeChanged(true)
    },
    onError: onError(m.employer_campaign_content_update_error()),
  })
  const pending = update.isPending ? update.variables : {}
  const text = postText(channel.rendered_content)
  const facebookPage = channel.kind === 'facebook_page'

  return (
    <ol className="ch-steps">
      <Step index={1} title={m.employer_campaign_post_step_scope()}>
        <PostScope
          channel={channel}
          jobs={pending.jobs || channel.jobs}
          target={pending.target || channel.target}
          editable={editable}
          onChange={(payload) => update.mutate(payload)}
        />
      </Step>

      <Step index={2} title={m.employer_campaign_post_step_content()}>
        {scopeChanged && text && <p className="ch-scope__stale" role="status">{m.employer_campaign_post_regenerate_hint()}</p>}
        <div className="ch-content">
          <SocialPostPreview
            name={channel.label}
            meta={channel.kind_label}
            text={text}
            link={channel.kind.startsWith('facebook') ? channel.link : ''}
            linkTitle={campaign.name}
          />
          <div className="ch-content__side">
            {editable && (
              <div className="ch-actions">
                <Button type={text ? 'default' : 'primary'} icon={<RobotOutlined aria-hidden />} loading={generate.isPending} onClick={() => generate.mutate()}>
                  {text ? m.employer_campaign_content_regenerate() : m.employer_campaign_content_generate()}
                </Button>
                <Button icon={<EditOutlined aria-hidden />} onClick={() => onEditContent(channel)}>{m.employer_campaign_content_edit_manually()}</Button>
              </div>
            )}
            <p className="ch-section-note">
              {channel.content_source === 'ai' ? m.employer_campaign_content_source_ai() : m.employer_campaign_content_source_hint()}
            </p>
          </div>
        </div>
      </Step>

      <Step index={3} title={m.employer_campaign_post_step_publish()}>
        {!text && <p className="ch-section-note">{m.employer_campaign_post_publish_need_content()}</p>}
        {facebookPage ? (
          <ChannelFacebookPosts campaign={campaign} channel={channel} editable={editable} message={text} />
        ) : (
          <div className="ch-publish">
            <p className="ch-section-note">{m.employer_campaign_post_manual_note({ kind: channel.kind_label })}</p>
            <div className="ch-actions">
              <Button type="primary" icon={<CopyOutlined aria-hidden />} disabled={!text} onClick={() => copyText(text, m.employer_campaign_content_copy_label(), message)}>
                {m.employer_campaign_content_copy()}
              </Button>
            </div>
            {editable && (
              <div className="ch-manual">
                <Checkbox checked={Boolean(channel.posted_at)} onChange={(event) => update.mutate({ posted: event.target.checked })}>
                  {m.employer_campaign_content_posted()}
                </Checkbox>
                {channel.posted_at && (
                  <Input
                    value={postedUrl}
                    placeholder={m.employer_campaign_content_posted_url_placeholder()}
                    onChange={(event) => setPostedUrl(event.target.value)}
                    onBlur={() => postedUrl !== (channel.posted_url || '') && update.mutate({ posted_url: postedUrl.trim() })}
                  />
                )}
              </div>
            )}
          </div>
        )}
      </Step>
    </ol>
  )
}
