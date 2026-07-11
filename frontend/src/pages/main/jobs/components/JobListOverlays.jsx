import { GoogleReCaptchaProvider } from 'react-google-recaptcha-v3'
import { Drawer, Modal } from 'antd'
import Login from '../../auth/Login'
import JobQuickView from './JobQuickView'

export default function JobListOverlays({
  filterDrawerOpen,
  filterSidebar,
  isAuthenticated,
  isDesktop,
  loginModalOpen,
  quickViewJob,
  onFilterDrawerClose,
  onLoginClose,
  onLoginSuccess,
  onQuickViewClose,
  onRequireLogin,
}) {
  return (
    <>
      <Drawer
        open={filterDrawerOpen}
        onClose={onFilterDrawerClose}
        placement="left"
        size={320}
        styles={{ body: { padding: 0 }, header: { padding: '12px 16px' } }}
        title="Lọc nâng cao"
        className="lg:hidden"
      >
        <div className="h-full [&_.filter-sidebar]:h-full">{filterSidebar}</div>
      </Drawer>

      <Drawer
        open={Boolean(quickViewJob) && !isDesktop}
        onClose={onQuickViewClose}
        placement="bottom"
        size="92%"
        closable={false}
        styles={{ body: { padding: 0 } }}
        className="lg:hidden"
        rootClassName="[&_.ant-drawer-content]:!rounded-t-2xl [&_.ant-drawer-content]:overflow-hidden"
      >
        {quickViewJob && (
          <div className="h-full overflow-y-auto [&>div]:!rounded-none [&>div]:!border-0">
            <JobQuickView
              job={quickViewJob}
              onClose={onQuickViewClose}
              isAuthenticated={isAuthenticated}
              onRequireLogin={onRequireLogin}
            />
          </div>
        )}
      </Drawer>

      <Modal
        open={loginModalOpen}
        onCancel={onLoginClose}
        footer={null}
        centered
        width={640}
        destroyOnHidden
        styles={{
          container: { borderRadius: 28, padding: 0, overflow: 'hidden' },
          body: { padding: '40px 48px 36px' },
        }}
      >
        <GoogleReCaptchaProvider reCaptchaKey={import.meta.env.VITE_RECAPTCHA_SITE_KEY}>
          <Login onSuccess={onLoginSuccess} />
        </GoogleReCaptchaProvider>
      </Modal>
    </>
  )
}
