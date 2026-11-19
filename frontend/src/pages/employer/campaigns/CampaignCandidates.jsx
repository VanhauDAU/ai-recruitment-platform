import { UserOutlined } from '@ant-design/icons'
import { Tag } from 'antd'
import { useState } from 'react'
import { Link } from 'react-router'
import { m } from '@/shared/config/i18n'
import { employerAppPath } from '@/shared/config/portals'

const AVATAR_TONES = [
  'bg-sky-500',
  'bg-violet-500',
  'bg-rose-500',
  'bg-amber-500',
  'bg-teal-500',
]

function initials(name) {
  const words = (name || '').trim().split(/\s+/).filter(Boolean)
  return words.slice(-2).map((word) => word[0]).join('').toUpperCase() || m.employer_campaign_candidates_initials_fallback()
}

function CandidateAvatar({ candidate, index, total }) {
  const [imageFailed, setImageFailed] = useState(false)
  const hasImage = Boolean(candidate.avatar_url) && !imageFailed

  return (
    <span
      title={candidate.full_name}
      style={{ zIndex: total - index }}
      className={`-ml-2.5 inline-flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border-2 border-white text-[10px] font-bold text-white shadow-sm first:ml-0 ${AVATAR_TONES[index % AVATAR_TONES.length]}`}
    >
      {hasImage ? (
        <img
          alt=""
          className="h-full w-full object-cover"
          src={candidate.avatar_url}
          onError={() => setImageFailed(true)}
        />
      ) : candidate.public_id === 'candidate-placeholder' ? (
        <UserOutlined aria-hidden className="text-sm" />
      ) : initials(candidate.full_name)}
    </span>
  )
}

function CampaignCandidateAvatars({ campaign }) {
  const candidateCount = Number(campaign.candidate_count) || 0
  const previews = (campaign.candidate_previews || []).slice(0, 5)
  const candidates = previews.length > 0
    ? previews
    : candidateCount > 0
      ? [{ public_id: 'candidate-placeholder', full_name: m.employer_campaign_cv_candidate_fallback() }]
      : []
  const extraCount = Math.max(candidateCount - candidates.length, 0)

  if (candidateCount === 0) {
    return <span className="text-sm text-slate-500">{m.employer_campaign_candidates_none()}</span>
  }

  return (
    <div
      aria-label={m.employer_campaign_candidates_count({ count: candidateCount })}
      className="flex h-8 items-center pl-1"
      role="img"
    >
      {candidates.map((candidate, index) => (
        <CandidateAvatar
          key={candidate.public_id}
          candidate={candidate}
          index={index}
          total={candidates.length}
        />
      ))}
      {extraCount > 0 && (
        <span
          className="-ml-2.5 inline-flex h-8 min-w-8 items-center justify-center rounded-full border-2 border-white bg-slate-700 px-1 text-[10px] font-bold text-white shadow-sm"
          title={m.employer_campaign_candidates_extra({ count: extraCount })}
        >
          +{extraCount}
        </span>
      )}
    </div>
  )
}

export default function CampaignCandidateSummary({ campaign, candidateDataAccess }) {
  const applicationCount = campaign.application_pair_count
    ?? campaign.application_submission_count
    ?? campaign.application_count
    ?? 0
  if (!candidateDataAccess) {
    return (
      <div className="min-w-36 text-slate-700">
        <span className="block text-sm font-semibold">
          {m.employer_campaign_candidates_count({ count: Number(campaign.candidate_count) || 0 })}
        </span>
        <span className="mt-1 block text-xs text-slate-500">
          {m.employer_campaign_candidates_applications({ count: applicationCount })}
        </span>
      </div>
    )
  }
  return (
    <Link
      to={employerAppPath(`/campaigns/${campaign.public_id}?active_tab=apply_cv`)}
      className="block min-w-36 !text-slate-700"
    >
      <CampaignCandidateAvatars campaign={campaign} />
      <span className="mt-1 block text-xs text-slate-500">
        {m.employer_campaign_candidates_applications({ count: applicationCount })}
      </span>
      {(campaign.unviewed_count ?? campaign.unviewed_application_count) > 0 && (
        <Tag className="mt-2" color="green">
          {m.employer_campaign_candidates_unviewed({ count: campaign.unviewed_count ?? campaign.unviewed_application_count })}
        </Tag>
      )}
    </Link>
  )
}
