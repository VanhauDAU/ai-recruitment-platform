import { CheckCircleFilled, EditOutlined, FolderOpenOutlined, TrophyOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { Skeleton } from 'antd'
import { Link, useNavigate } from 'react-router'
import { CvTemplateCard, getCvTemplates } from '@/entities/cv/cv-template'

const CV_ONLINE_BENEFITS = [
  { icon: TrophyOutlined, title: 'Ấn tượng hơn với NTD', text: 'Mẫu CV được thiết kế chuyên nghiệp, bố cục rõ ràng và thân thiện với phần mềm ATS.' },
  { icon: EditOutlined, title: 'Chỉnh sửa online dễ dàng', text: 'Cập nhật thông tin nhanh chóng ở bất cứ đâu, trên mọi thiết bị.' },
  { icon: FolderOpenOutlined, title: 'Quản lý CV thuận tiện', text: 'Lưu trữ, chỉnh sửa, xuất PDF và chia sẻ CV ngay trong tài khoản của bạn.' },
]

function TemplateGrid({ templates, onUse }) {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {templates.map((template) => <CvTemplateCard key={template.public_id} template={template} onUse={onUse} />)}
    </div>
  )
}

/** Màn hình sau khi tải CV lên: điều hướng tiếp và gợi ý chuyển sang CV online. */
export default function UploadCvSuccess({ siteName, cvPublicId }) {
  const navigate = useNavigate()
  const { data, isLoading } = useQuery({
    queryKey: ['cv-templates', 'upload-success'],
    queryFn: () => getCvTemplates(),
    staleTime: 5 * 60_000,
  })
  const templates = (data?.results || []).slice(0, 6)
  // Trang mẫu mở sẵn nguồn "Tải CV lên" để AI chuyển CV hiện có sang mẫu đã chọn.
  const openTemplate = (template) => navigate(`/mau-cv/chi-tiet/${template.slug}?nguon=tai-len`)

  return (
    <div className="bg-gradient-to-b from-[var(--brand-primary-soft)] via-white to-slate-50 pb-12">
      <section className="px-4 pb-8 pt-10 text-center">
        <CheckCircleFilled className="text-5xl text-[#00b14f]" />
        <h1 className="mt-3 text-2xl font-extrabold text-[#00a848] md:text-3xl">Đã tải lên CV thành công!</h1>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <Link to={`/cv/${cvPublicId}/xem`} target="_blank" rel="noopener noreferrer" className="rounded-full border-2 border-[var(--brand-primary)] !bg-white px-6 py-2.5 font-bold !text-[var(--brand-primary)] transition hover:!bg-[var(--brand-primary-soft)]">
            Xem CV tải lên của tôi
          </Link>
          <Link to="/viec-lam" className="rounded-full border-2 border-[var(--brand-primary)] !bg-[var(--brand-primary)] px-6 py-2.5 font-bold !text-white transition hover:!bg-[#009643]">
            Xem việc làm phù hợp
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-6xl space-y-8 px-4">
        <div className="text-center">
          <h2 className="text-xl font-extrabold text-[#26384a] md:text-2xl">Dễ dàng vượt qua phần mềm ATS với CV Online chuẩn {siteName}</h2>
          <p className="mt-2 text-sm text-slate-600 md:text-base">Chọn mẫu yêu thích, hệ thống sẽ chuyển CV hiện tại của bạn sang định dạng tối ưu ATS chỉ trong vài giây.</p>
        </div>
        {isLoading ? <Skeleton active paragraph={{ rows: 8 }} /> : <TemplateGrid templates={templates.slice(0, 3)} onUse={openTemplate} />}

        <div className="rounded-2xl bg-white p-6 shadow-[0_2px_14px_rgba(15,23,42,0.05)]">
          <h2 className="text-center text-xl font-extrabold text-[#00a848] md:text-2xl">Những lợi ích khi sử dụng CV Online</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            {CV_ONLINE_BENEFITS.map(({ icon: Icon, title, text }) => (
              <div key={title} className="flex gap-3 rounded-xl border border-slate-200 p-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--brand-primary-soft)] text-lg text-[var(--brand-primary)]"><Icon /></span>
                <div>
                  <h3 className="font-bold text-[#00a848]">{title}</h3>
                  <p className="mt-1 text-sm leading-6 text-slate-600">{text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {templates.length > 3 && <TemplateGrid templates={templates.slice(3)} onUse={openTemplate} />}
      </section>
    </div>
  )
}
