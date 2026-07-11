import { Drawer } from 'antd'
import JobQuickView from './JobQuickView'

export default function JobListOverlays({
  filterDrawerOpen,
  filterSidebar,
  isAuthenticated,
  isDesktop,
  quickViewJob,
  onFilterDrawerClose,
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
    </>
  )
}
