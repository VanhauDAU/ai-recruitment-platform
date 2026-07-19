import {
  DownloadOutlined,
  UploadOutlined,
  WarningFilled,
} from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { Button, Radio, Skeleton, Upload } from 'antd'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { getEmployerProfile } from '@/entities/employer-profile'
import { EMPLOYER_COMPANY_SETTINGS_URL } from '@/shared/config/portals'

const UPLOAD_GUIDE_URL = 'https://drive.google.com/file/d/1yYXQMXUjW7_vF3dlpsQd0EBo8WinH9K-/view'
const AUTHORIZATION_TEMPLATE_URL = 'https://docs.google.com/document/d/1_cQDRuVuibU7XP1YPcsjpSYB8jokcqyR/edit?usp=sharing&ouid=111388583364027655585&rtpof=true&sd=true'
const ACCEPTED_FILE_TYPES = '.jpeg,.jpg,.png,.pdf'
const UPLOAD_HINT = 'Dung lượng tối đa 5MB, định dạng: jpeg, jpg, png, pdf'
const SAMPLE_IMAGES = {
  business: { src: '/images/employer/business-registration-sample.jpg', alt: 'Minh họa giấy chứng nhận đăng ký doanh nghiệp' },
  authorization: { src: '/images/employer/authorization-sample.jpg', alt: 'Minh họa giấy ủy quyền' },
  identity: { src: '/images/employer/identity-sample.jpg', alt: 'Minh họa căn cước công dân hoặc hộ chiếu' },
}

function Illustration({ variant }) {
  const image = SAMPLE_IMAGES[variant]

  return <img src={image.src} alt={image.alt} className="h-[128px] max-w-[176px] rounded border border-slate-200 bg-white object-contain shadow-sm" loading="lazy" />
}

function UploadBox({ label, files, onFilesChange }) {
  return (
    <div className="min-w-0">
      <h3 className="mb-2 text-sm font-semibold text-slate-800">{label} <span className="text-red-500">*</span></h3>
      <Upload.Dragger
        accept={ACCEPTED_FILE_TYPES}
        beforeUpload={() => false}
        fileList={files}
        maxCount={1}
        multiple={false}
        showUploadList={false}
        onChange={({ fileList }) => onFilesChange(fileList.slice(-1))}
        className="!rounded-lg !border-dashed !border-slate-300 !bg-white !px-4 !py-2 hover:!border-emerald-500"
      >
        <p className="mb-1 text-sm font-medium text-slate-600">Chọn hoặc kéo file vào đây</p>
        <p className="mb-2 text-xs text-slate-500">{UPLOAD_HINT}</p>
        <Button type="text" icon={<UploadOutlined />} className="!h-8 !border !border-emerald-100 !bg-emerald-50 !text-emerald-600">Chọn file</Button>
      </Upload.Dragger>
      {files[0] && <p className="mt-2 truncate text-xs text-emerald-700">Đã chọn: {files[0].name}</p>}
    </div>
  )
}

function UploadNotice({ documentName }) {
  return (
    <div className="mt-2 flex gap-2 rounded-lg bg-orange-50 px-3 py-2 text-xs leading-5 text-orange-600">
      <WarningFilled className="mt-0.5 shrink-0" />
      <ul className="list-disc space-y-0.5 pl-3">
        <li>Các văn bản đăng tải cần đầy đủ các mặt và không có dấu hiệu chỉnh sửa/ che/ cắt thông tin.</li>
        {documentName && <li>Vui lòng đăng tải {documentName} có thông tin trùng khớp với dữ liệu doanh nghiệp theo Trang thông tin điện tử của Cục Thuế.</li>}
      </ul>
    </div>
  )
}

function DocumentCard({ label, files, onFilesChange, variant, noticeDocument, showTemplate = false }) {
  return (
    <section className="rounded-lg border border-slate-200 p-5 sm:p-6">
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_220px]">
        <div>
          <UploadBox label={label} files={files} onFilesChange={onFilesChange} />
          <UploadNotice documentName={noticeDocument} />
        </div>
        <aside className="flex flex-col items-center gap-3 text-center">
          <p className="text-sm font-medium text-slate-800">Minh họa</p>
          <Illustration variant={variant} />
          {showTemplate && <a href={AUTHORIZATION_TEMPLATE_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-md border border-emerald-500 px-4 py-2 text-sm font-medium text-emerald-600 transition hover:bg-emerald-50"><DownloadOutlined />Tải mẫu giấy ủy quyền</a>}
        </aside>
      </div>
    </section>
  )
}

export default function EmployerBusinessLicenseForm() {
  const [method, setMethod] = useState('business_registration')
  const [businessFiles, setBusinessFiles] = useState([])
  const [authorizationFiles, setAuthorizationFiles] = useState([])
  const [identityFiles, setIdentityFiles] = useState([])
  const profileQuery = useQuery({ queryKey: ['employer', 'profile'], queryFn: getEmployerProfile })

  if (profileQuery.isLoading) return <Skeleton active paragraph={{ rows: 10 }} />

  const companyLinked = Boolean(profileQuery.data?.onboarding?.company_linked)
  const saveHint = companyLinked ? 'Chức năng lưu chưa được bật' : 'Cần cập nhật thông tin công ty trước khi lưu'
  return (
    <div>
      <h2 className="text-base font-semibold text-slate-800">Thông tin Giấy đăng ký doanh nghiệp</h2>
      <p className="mt-6 text-sm text-slate-700">Vui lòng lựa chọn phương thức đăng tải, xem hướng dẫn đăng tải <a href={UPLOAD_GUIDE_URL} target="_blank" rel="noreferrer" className="font-medium text-emerald-600 hover:text-emerald-700">Tại đây</a></p>

      <Radio.Group value={method} onChange={(event) => setMethod(event.target.value)} className="!mt-6 !grid !gap-0">
        <Radio value="business_registration" className="!my-3 !mr-0 !text-sm !font-semibold !text-slate-800">Giấy đăng ký doanh nghiệp hoặc Giấy tờ tương đương khác</Radio>
        {method === 'business_registration' && <div className="mb-4"><DocumentCard label="Giấy tờ" files={businessFiles} onFilesChange={setBusinessFiles} variant="business" noticeDocument="Giấy đăng ký doanh nghiệp" /></div>}

        <Radio value="authorization_and_id" className="!my-3 !mr-0 !text-sm !font-semibold !text-slate-800">Giấy ủy quyền và Giấy tờ định danh</Radio>
        {method === 'authorization_and_id' && (
          <div className="mb-4 mt-1 grid gap-5">
            <DocumentCard label="Giấy ủy quyền" files={authorizationFiles} onFilesChange={setAuthorizationFiles} variant="authorization" noticeDocument="Giấy ủy quyền" showTemplate />
            <DocumentCard label="Giấy tờ định danh (CCCD/ Hộ chiếu)" files={identityFiles} onFilesChange={setIdentityFiles} variant="identity" />
          </div>
        )}
      </Radio.Group>

      <div className="mt-5 flex flex-col items-end gap-2">
        <Button type="primary" size="large" disabled title={saveHint} className="!min-w-[100px] !shadow-none">Lưu</Button>
        {!companyLinked && <p className="text-right text-xs text-slate-500">Bạn cần <Link to={`${EMPLOYER_COMPANY_SETTINGS_URL}?update=true`} className="font-medium text-emerald-600 hover:text-emerald-700">cập nhật thông tin công ty</Link> trước khi có thể lưu giấy tờ.</p>}
      </div>
    </div>
  )
}
