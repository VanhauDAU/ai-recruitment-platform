// Modal ứng tuyển: compose UI từ model hook + 2 section component.
// Nghiệp vụ (load CV, upload, validate, submit) nằm ở ../model/use-apply-form.
import {
  DownOutlined,
  ExclamationCircleFilled,
  FolderFilled,
  FormOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons'
import { Alert, Button, Checkbox, Input, Modal, Select, Spin } from 'antd'
import { settingText, useSiteSettings } from '@/entities/site-settings'
import { INITIAL_VISIBLE_CVS, UPLOAD_CHOICE_ID, useApplyForm } from '../model/use-apply-form'
import CvChoice from './CvChoice'
import UploadChoice from './UploadChoice'

export default function ApplyForJobModal({
  open,
  onClose,
  onSubmitted,
  jobPublicId,
  jobTitle,
  workplaceGroups = [],
  candidateName = '',
  candidateEmail = '',
  candidatePhone = '',
}) {
  const { settings } = useSiteSettings()
  const supportEmail = settingText(settings.support_email, 'support@procv.vn')
  const siteName = settingText(settings.site_name, 'ProCV')
  const form = useApplyForm({
    open,
    onClose,
    onSubmitted,
    jobPublicId,
    workplaceGroups,
    candidateName,
    candidateEmail,
    candidatePhone,
  })

  return (
    <Modal
      title={(
        <div className="pr-8">
          <h2 className="text-xl font-bold text-slate-900">Ứng tuyển</h2>
          {jobTitle && <p className="mt-0.5 truncate text-sm font-normal text-slate-500">{jobTitle}</p>}
        </div>
      )}
      open={open}
      onCancel={onClose}
      destroyOnHidden
      footer={null}
      width={650}
      centered
      styles={{
        body: { padding: 0 },
        content: { borderRadius: 8, overflow: 'hidden', padding: 0 },
        header: { padding: '20px 32px 16px', margin: 0, borderBottom: '1px solid #f1f2f4' },
      }}
    >
      <div className="max-h-[min(72vh,820px)] overflow-y-auto bg-white px-8 py-4 [scrollbar-color:#cbd5e1_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300 [&::-webkit-scrollbar-track]:bg-transparent">
        {form.error && (
          <Alert type="error" showIcon title={form.error} closable onClose={() => form.setError('')} className="mb-4" />
        )}

        <section aria-labelledby="application-cv-heading">
          <h3 id="application-cv-heading" className="flex items-center gap-2 text-base font-bold text-slate-700">
            <span className="flex h-5 w-5 items-center justify-center rounded-sm bg-[var(--brand-primary)] text-xs text-white">
              <FolderFilled />
            </span>
            Chọn CV để ứng tuyển
          </h3>

          <div className="mt-3 space-y-2.5" role="radiogroup" aria-label="CV ứng tuyển">
            {form.loadingCvs ? (
              <div className="flex justify-center py-10"><Spin /></div>
            ) : (
              form.visibleCvs.map((cv) => (
                <CvChoice
                  key={cv.public_id}
                  cv={cv}
                  selected={cv.public_id === form.selectedCvId}
                  onSelect={form.setSelectedCvId}
                />
              ))
            )}
          </div>

          {form.cvs.length > INITIAL_VISIBLE_CVS && (
            <button
              type="button"
              onClick={() => form.setShowAllCvs((current) => !current)}
              className="mt-9 flex w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-slate-100 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-200"
            >
              {form.showAllCvs ? 'Thu gọn' : 'Xem thêm'} <DownOutlined className={form.showAllCvs ? 'rotate-180' : ''} />
            </button>
          )}

        </section>

        <section className="mt-5" aria-label="Tải CV từ máy tính">
          <input ref={form.fileInputRef} type="file" accept=".pdf,.docx" className="hidden" onChange={form.handleUploadInput} />
          <UploadChoice
            selected={form.isUploadChoice}
            uploading={form.uploading}
            file={form.uploadFile}
            onSelect={() => form.setSelectedCvId(UPLOAD_CHOICE_ID)}
            onChooseFile={() => form.fileInputRef.current?.click()}
            onDeleteFile={() => {
              form.setUploadFile(null)
              form.setUploadedCv(null)
            }}
            onDrop={form.handleDrop}
            contactName={form.contactName}
            contactEmail={form.contactEmail}
            contactPhone={form.contactPhone}
            onContactNameChange={form.setContactName}
            onContactEmailChange={form.setContactEmail}
            onContactPhoneChange={form.setContactPhone}
          />
        </section>

        {form.needsLocation && (
          <section className="mt-3" aria-labelledby="preferred-location-heading">
            <h3 id="preferred-location-heading" className="text-sm font-bold text-slate-700">
              Địa điểm làm việc mong muốn <span className="text-rose-500">*</span>
            </h3>
            <Select
              mode="multiple"
              size="large"
              aria-label="Địa điểm làm việc mong muốn"
              className="mt-2 w-full"
              value={form.preferredLocationIds}
              onChange={form.setPreferredLocationIds}
              open={form.locationDropdownOpen}
              onOpenChange={form.setLocationDropdownOpen}
              onSelect={() => form.setLocationDropdownOpen(false)}
              options={form.locationOptions}
              maxTagCount="responsive"
              placeholder="Chọn địa điểm"
            />
          </section>
        )}

        <section className="mt-5" aria-labelledby="cover-letter-heading">
          <h3 id="cover-letter-heading" className="flex items-center gap-2 text-lg font-bold text-slate-700">
            <FormOutlined className="text-xl text-[var(--brand-primary)]" />
            Thư giới thiệu:
          </h3>
          <p className="mt-1 text-sm leading-5 text-slate-400">
            Một thư giới thiệu ngắn gọn, chỉn chu sẽ giúp bạn trở nên chuyên nghiệp và gây ấn tượng hơn với nhà tuyển dụng.
          </p>
          <Input.TextArea
            aria-label="Thư giới thiệu"
            className="mt-2 !rounded-xl"
            value={form.coverLetter}
            onChange={(event) => form.setCoverLetter(event.target.value)}
            maxLength={10000}
            showCount
            rows={4}
            placeholder="Viết giới thiệu ngắn gọn về bản thân (điểm mạnh, điểm yếu) và nêu rõ mong muốn, lý do bạn muốn ứng tuyển cho vị trí này."
          />
        </section>

        <section className="mt-5 border-t border-slate-100 pt-5" aria-labelledby="application-notice-heading">
          <p id="application-notice-heading" className="flex items-center gap-2 text-sm font-bold text-slate-800">
            <SafetyCertificateOutlined className="text-rose-500" /> Lưu ý
          </p>
          <ol className="mt-3 space-y-3 text-sm leading-6 text-slate-600">
            <li className="flex gap-3">
              <ExclamationCircleFilled className="mt-1 shrink-0 text-rose-500" />
              <span>
                <strong className="text-slate-800">1.</strong> {siteName} khuyên tất cả các bạn hãy luôn cẩn trọng trong quá trình tìm việc và chủ động nghiên cứu thông tin công ty, vị trí việc làm trước khi ứng tuyển.
              </span>
            </li>
            <li className="flex gap-3">
              <ExclamationCircleFilled className="mt-1 shrink-0 text-rose-500" />
              <span>
                <strong className="text-slate-800">2.</strong> Ứng viên cần có trách nhiệm với hành vi ứng tuyển của mình. Nếu gặp tin tuyển dụng hoặc liên hệ đáng ngờ của Nhà tuyển dụng, hãy báo cáo ngay cho {siteName} qua email{' '}
                <a href={`mailto:${supportEmail}`} className="font-semibold text-[var(--brand-primary)] underline">{supportEmail}</a>{' '}
                để được hỗ trợ kịp thời.
              </span>
            </li>
          </ol>
        </section>
      </div>

      <div className="sticky bottom-0 z-10 border-t border-slate-200 bg-white px-8 py-4 shadow-[0_-8px_20px_rgba(15,23,42,0.06)]">
        <div className="mb-3 space-y-2.5 text-sm text-slate-700">
          <Checkbox checked={form.allowAiAnalysis} onChange={(event) => form.setAllowAiAnalysis(event.target.checked)}>
            Cho phép {siteName} sử dụng <span className="underline">công nghệ AI</span> để phân tích độ phù hợp CV của bạn
          </Checkbox>
          <Checkbox
            checked={form.dataProcessingConsent}
            onChange={(event) => form.setDataProcessingConsent(event.target.checked)}
          >
            Tôi đã đọc và đồng ý với <span className="underline">&quot;Thỏa thuận sử dụng dữ liệu cá nhân&quot;</span> của Nhà tuyển dụng
            <span className="text-rose-500"> *</span>
          </Checkbox>
        </div>
        <Button
          block
          type="primary"
          size="large"
          loading={form.submitting}
          disabled={!form.selectionReady}
          onClick={form.submit}
          className="!h-10 !rounded-md !border-[var(--brand-primary)] !bg-[var(--brand-primary)] !font-bold hover:!border-[var(--brand-primary-hover)] hover:!bg-[var(--brand-primary-hover)]"
        >
          Nộp hồ sơ ứng tuyển
        </Button>
      </div>
    </Modal>
  )
}
