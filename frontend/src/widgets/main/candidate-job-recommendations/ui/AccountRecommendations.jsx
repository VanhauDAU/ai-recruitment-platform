import { ReloadOutlined, SettingOutlined } from '@ant-design/icons'
import { Alert, Button, Pagination, Skeleton } from 'antd'
import { Link } from 'react-router'
import { EnableAiRecommendationButton } from '@/features/main/job/toggle-ai-recommendation'
import { m } from '@/shared/config/i18n'
import { MascotEmpty, ProcvMascot } from '@/shared/ui/mascot'
import MatchingJobCard from './MatchingJobCard'
import SetupState from './SetupState'

const SETTINGS_PATH = '/tai-khoan/cai-dat-goi-y-viec-lam'

function AccountLoading() {
  return (
    <div className="space-y-3" aria-label="Đang tải việc làm phù hợp">
      {[0, 1, 2].map((item) => (
        <div key={item} className="rounded-2xl border border-slate-200 bg-white p-5">
          <Skeleton active avatar paragraph={{ rows: 3 }} />
        </div>
      ))}
    </div>
  )
}

function Header() {
  return (
    <header className="relative overflow-hidden rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-emerald-50 px-5 py-6 sm:px-8 sm:py-8">
      <div className="relative max-w-xl pr-20 sm:pr-40">
        <h1 className="text-xl font-extrabold text-slate-900 sm:text-2xl">{m.candidate_reco_title()}</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">{m.candidate_reco_intro()}</p>
      </div>
      <ProcvMascot pose="checklist" emotion="happy" float size={112} className="!absolute bottom-1 right-3 sm:right-8 max-sm:!h-20 max-sm:!w-20" />
    </header>
  )
}

// Ứng viên tắt gợi ý bằng AI: danh sách vẫn hiện nhưng không đọc CV, mời bật lại.
function AiOffNotice({ strategy }) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-sm font-bold text-slate-900">{m.candidate_reco_off_title()}</p>
        <p className="mt-0.5 text-sm text-slate-600">
          {strategy === 'latest-v1' ? m.candidate_reco_off_latest() : m.candidate_reco_off_preferences()}
        </p>
      </div>
      <EnableAiRecommendationButton />
    </div>
  )
}

export default function AccountRecommendations({ data, hiddenIds, hide, page, pendingIds, query, setPage }) {
  const jobs = (data?.results || []).filter((job) => !hiddenIds.has(job.public_id))

  return (
    <section className="space-y-4">
      <Header />

      {query.isPending && <AccountLoading />}
      {query.isError && (
        <Alert
          showIcon
          type="error"
          title="Không thể tải việc làm phù hợp"
          description="Kết nối chưa ổn định. Vui lòng thử lại."
          action={<Button icon={<ReloadOutlined />} onClick={() => query.refetch()}>Thử lại</Button>}
        />
      )}
      {data?.status === 'preferences_required' && <SetupState cvEnabled={data.cv_recommendations_enabled} />}
      {data?.status === 'consent_required' && <SetupState consentRequired />}

      {data?.status === 'ready' && (
        <>
          {data.ai_recommendation_enabled === false && <AiOffNotice strategy={data.strategy} />}
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-1">
            <p className="text-sm text-slate-700">
              {m.candidate_reco_found()}{' '}
              <b className="text-[var(--brand-primary)]">{data.pagination?.total || 0}</b>{' '}
              {data.strategy === 'latest-v1' ? m.candidate_reco_found_latest() : m.candidate_reco_found_matching()}
            </p>
            <Link to={SETTINGS_PATH} className="inline-flex items-center gap-1 text-xs font-bold text-[var(--brand-primary)] hover:underline">
              <SettingOutlined /> {data.preference_configured ? m.candidate_reco_update_preferences() : m.candidate_reco_add_preferences()}
            </Link>
          </div>

          {jobs.length ? (
            <div className="space-y-3">
              {jobs.map((job) => (
                <MatchingJobCard
                  key={job.public_id}
                  job={job}
                  hidePending={pendingIds.has(job.public_id)}
                  onHide={(selected) => hide(selected, 'matching')}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white px-5 py-10">
              <MascotEmpty
                scene="profileCheck"
                description={(
                  <>
                    <h2 className="font-bold text-slate-800">Chưa có việc làm đủ phù hợp</h2>
                    <p className="mt-1 text-sm text-slate-500">{m.candidate_reco_empty_text()}</p>
                  </>
                )}
              />
            </div>
          )}

          {(data.pagination?.total_pages || 0) > 1 && (
            <div className="flex justify-center rounded-2xl border border-slate-200 bg-white py-4">
              <Pagination
                current={page}
                pageSize={data.pagination.page_size}
                total={data.pagination.total}
                showSizeChanger={false}
                onChange={setPage}
              />
            </div>
          )}
        </>
      )}
    </section>
  )
}

