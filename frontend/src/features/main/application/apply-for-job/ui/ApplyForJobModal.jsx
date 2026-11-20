// Modal ứng tuyển: compose UI từ model hook + các section component.
// Nghiệp vụ (load CV, upload, validate, submit) nằm ở ../model/use-apply-form.
import { DownOutlined, FolderFilled, FormOutlined, SafetyCertificateOutlined } from '@ant-design/icons'
import { Alert, Button, Checkbox, Input, Modal, Select, Spin } from 'antd'
import { CvChoice } from '@/entities/cv/cv'
import { DEFAULT_SITE_SETTINGS, settingText, useSiteSettings } from '@/entities/system/site-settings'
import { INITIAL_VISIBLE_CVS, UPLOAD_CHOICE_ID, useApplyForm } from '../model/use-apply-form'
import ContactFields from './ContactFields'
import UploadChoice from './UploadChoice'
import './apply-form.css'

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
  isReapplication = false,
  retriesRemaining = null,
}) {
  const { settings } = useSiteSettings()
  const supportEmail = settingText(settings.support_email, DEFAULT_SITE_SETTINGS.support_email)
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
  // Một form liên hệ duy nhất, hiện ngay trong lựa chọn CV dạng tệp đang được chọn.
  const contactFields = (
    <ContactFields
      name={form.contactName}
      email={form.contactEmail}
      phone={form.contactPhone}
      onNameChange={form.setContactName}
      onEmailChange={form.setContactEmail}
      onPhoneChange={form.setContactPhone}
    />
  )

  return (
    <Modal
      title={(
        <div className="af-head">
          <h2 className="af-head__title">Ứng tuyển</h2>
          {jobTitle && <p className="af-head__job">{jobTitle}</p>}
        </div>
      )}
      open={open}
      onCancel={onClose}
      destroyOnHidden
      footer={null}
      width={620}
      centered
      styles={{
        body: { padding: 0 },
        content: { borderRadius: 8, overflow: 'hidden', padding: 0 },
        header: { padding: '16px 24px 12px', margin: 0, borderBottom: '1px solid #f1f2f4' },
      }}
    >
      <div className="af-scroll">
        {isReapplication && (
          <Alert
            type="warning"
            showIcon
            title={<strong>Lưu ý</strong>}
            description={<>Việc ứng tuyển nhiều lần sẽ giảm độ chuyên nghiệp của bạn trong mắt nhà tuyển dụng.{retriesRemaining != null && <> Bạn còn <strong>{retriesRemaining} lượt</strong> ứng tuyển lại cho công việc này.</>} Hãy cân nhắc kỹ!</>}
            className="af-alert"
          />
        )}
        {form.error && (
          <Alert type="error" showIcon title={form.error} closable onClose={() => form.setError('')} className="af-alert" />
        )}

        <section aria-labelledby="application-cv-heading">
          <h3 id="application-cv-heading" className="af-heading">
            <FolderFilled className="af-heading__icon" /> Chọn CV để ứng tuyển
          </h3>

          <div className="af-list" role="radiogroup" aria-label="CV ứng tuyển">
            {form.loadingCvs ? (
              <div className="af-loading"><Spin /></div>
            ) : (
              form.visibleCvs.map((cv) => (
                <CvChoice
                  key={cv.public_id}
                  cv={cv}
                  selected={cv.public_id === form.selectedCvId}
                  onSelect={form.setSelectedCvId}
                  name="application-cv"
                  blockUnready
                  badge={cv.public_id === form.lastAppliedCvId ? 'CV ứng tuyển gần nhất' : null}
                >
                  {cv.cv_type === 'uploaded' && contactFields}
                </CvChoice>
              ))
            )}

            <input ref={form.fileInputRef} type="file" accept=".pdf,.docx" hidden onChange={form.handleUploadInput} />
            <UploadChoice
              selected={form.isUploadChoice}
              uploading={form.uploading}
              uploadState={form.uploadState}
              file={form.uploadFile}
              onSelect={() => form.setSelectedCvId(UPLOAD_CHOICE_ID)}
              onChooseFile={() => form.fileInputRef.current?.click()}
              onDeleteFile={() => {
                form.setUploadFile(null)
                form.setUploadedCv(null)
              }}
              onDrop={form.handleDrop}
            >
              {contactFields}
            </UploadChoice>
          </div>

          {form.cvs.length > INITIAL_VISIBLE_CVS && (
            <button type="button" onClick={() => form.setShowAllCvs((current) => !current)} className="af-more">
              {form.showAllCvs ? 'Thu gọn' : `Xem thêm ${form.cvs.length - INITIAL_VISIBLE_CVS} CV`}
              <DownOutlined className={form.showAllCvs ? 'af-more__icon--open' : ''} />
            </button>
          )}
        </section>

        {form.needsLocation && (
          <section className="af-section" aria-labelledby="preferred-location-heading">
            <h3 id="preferred-location-heading" className="af-label">
              Địa điểm làm việc mong muốn <span className="af-required">*</span>
            </h3>
            <Select
              mode="multiple"
              aria-label="Địa điểm làm việc mong muốn"
              className="af-control"
              value={form.preferredLocationIds}
              onChange={form.setPreferredLocationIds}
              open={form.locationDropdownOpen}
              onOpenChange={form.setLocationDropdownOpen}
              onSelect={() => form.setLocationDropdownOpen(false)}
              options={form.locationOptions}
              maxTagCount="responsive"
              placeholder="Chọn địa điểm bạn muốn làm việc"
            />
          </section>
        )}

        <section className="af-section" aria-labelledby="cover-letter-heading">
          <div className="af-cover-head">
            <h3 id="cover-letter-heading" className="af-heading">
              <FormOutlined className="af-heading__icon" /> Thư giới thiệu
            </h3>
            {form.lastCoverLetter && form.coverLetter.trim() !== form.lastCoverLetter && (
              <button type="button" className="af-link" onClick={() => form.setCoverLetter(form.lastCoverLetter)}>
                Sử dụng thư giới thiệu gần nhất
              </button>
            )}
          </div>
          <Input.TextArea
            aria-label="Thư giới thiệu"
            className="af-control"
            value={form.coverLetter}
            onChange={(event) => form.setCoverLetter(event.target.value)}
            maxLength={10000}
            rows={3}
            placeholder="Giới thiệu ngắn gọn về bản thân (điểm mạnh, điểm yếu) và lý do bạn muốn ứng tuyển vị trí này. Không bắt buộc."
          />
        </section>

        <section className="af-notice" aria-labelledby="application-notice-heading">
          <p id="application-notice-heading" className="af-notice__title">
            <SafetyCertificateOutlined className="af-notice__icon" /> Lưu ý
          </p>
          <p>
            1. {siteName} khuyên tất cả các bạn hãy luôn cẩn trọng trong quá trình tìm việc và chủ động nghiên cứu thông tin công ty, vị trí việc làm trước khi ứng tuyển.
          </p>
          <p>
            2. Ứng viên cần có trách nhiệm với hành vi ứng tuyển của mình. Nếu gặp tin tuyển dụng hoặc liên hệ đáng ngờ của Nhà tuyển dụng, hãy báo cáo ngay cho {siteName} qua email{' '}
            <a href={`mailto:${supportEmail}`}>{supportEmail}</a> để được hỗ trợ kịp thời.
          </p>
        </section>
      </div>

      <div className="af-footer">
        <div className="af-consents">
          <Checkbox checked={form.allowAiAnalysis} onChange={(event) => form.setAllowAiAnalysis(event.target.checked)}>
            Cho phép {siteName} sử dụng <span className="af-underline">công nghệ AI</span> để phân tích độ phù hợp CV của bạn
          </Checkbox>
          <Checkbox
            checked={form.dataProcessingConsent}
            onChange={(event) => form.setDataProcessingConsent(event.target.checked)}
          >
            Tôi đã đọc và đồng ý với <span className="af-underline">&quot;Thỏa thuận sử dụng dữ liệu cá nhân&quot;</span> của Nhà tuyển dụng
            <span className="af-required"> *</span>
          </Checkbox>
        </div>
        <Button
          block
          type="primary"
          size="large"
          loading={form.submitting}
          disabled={!form.selectionReady}
          onClick={form.submit}
        >
          Nộp hồ sơ ứng tuyển
        </Button>
      </div>
    </Modal>
  )
}
