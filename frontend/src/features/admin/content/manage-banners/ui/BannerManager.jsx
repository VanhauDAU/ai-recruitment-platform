import { PlusOutlined } from '@ant-design/icons'
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, arrayMove, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Button, Empty, Select, Skeleton } from 'antd'
import { useState } from 'react'
import {
  BANNER_PLACEMENTS,
  HOME_HERO_PLACEMENT,
  bannerKeys,
  deleteAdminBanner,
  getAdminBanners,
  reorderAdminBanners,
  updateAdminBanner,
} from '@/entities/content/banner'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { m } from '@/shared/config/i18n'
import { message } from '@/shared/lib/toast'
import useConfirmAction from '@/shared/ui/confirm-action/use-confirm-action'
import { PLACEMENT_LABELS } from '../model/banner-form'
import BannerFormDrawer from './BannerFormDrawer'
import BannerRow from './BannerRow'

/** Danh sách banner theo vị trí: bật/tắt, kéo thả hoặc nút lên/xuống để sắp thứ tự, sửa trong drawer. */
export default function BannerManager({ renderPreview }) {
  const queryClient = useQueryClient()
  const [placement, setPlacement] = useState(HOME_HERO_PLACEMENT)
  const [editing, setEditing] = useState(null)
  const { confirmationModal, requestConfirmation } = useConfirmAction()
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const key = bannerKeys.admin(placement)
  const { data: banners = [], isLoading, isError } = useQuery({
    queryKey: key,
    queryFn: ({ signal }) => getAdminBanners(placement, { signal }),
  })
  const refresh = () => queryClient.invalidateQueries({ queryKey: bannerKeys.adminRoot })
  const onError = (error) => {
    refresh()
    message.error(getApiErrorMessage(error, m.admin_banner_action_failed()))
  }

  const reorder = useMutation({
    mutationFn: (ids) => reorderAdminBanners(placement, ids),
    onMutate: (ids) => queryClient.setQueryData(key, (current = []) => ids.map((id) => current.find((item) => item.id === id))),
    onSuccess: refresh,
    onError,
  })
  const toggle = useMutation({
    mutationFn: ({ banner, active }) => updateAdminBanner(banner.id, { is_active: active }),
    onSuccess: refresh,
    onError,
  })

  const ids = banners.map((banner) => banner.id)
  const move = (index, direction) => reorder.mutate(arrayMove(ids, index, index + direction))
  const onDragEnd = ({ active, over }) => {
    if (over && active.id !== over.id) reorder.mutate(arrayMove(ids, ids.indexOf(active.id), ids.indexOf(over.id)))
  }
  const askDelete = (banner) => requestConfirmation({
    title: m.admin_banner_delete_title(),
    description: m.admin_banner_delete_description({ name: banner.title || banner.company?.company_name || '' }),
    confirmText: m.admin_banner_delete(),
    danger: true,
    onConfirm: () => deleteAdminBanner(banner.id).then(() => {
      message.success(m.admin_banner_deleted())
      refresh()
    }),
    onConfirmError: onError,
  })

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={placement}
          onChange={setPlacement}
          aria-label={m.admin_banner_placement()}
          options={BANNER_PLACEMENTS.map((value) => ({ value, label: PLACEMENT_LABELS[value]() }))}
          className="w-full sm:w-72"
        />
        <Button type="primary" icon={<PlusOutlined />} className="sm:ml-auto" onClick={() => setEditing({ placement })}>
          {m.admin_banner_add()}
        </Button>
      </div>
      <p className="text-xs text-slate-500">{placement === HOME_HERO_PLACEMENT ? m.admin_banner_hero_tip() : m.admin_banner_placement_tip()}</p>

      {isLoading && <Skeleton active paragraph={{ rows: 3 }} />}
      {isError && <Alert type="error" showIcon message={m.admin_banner_load_failed()} />}
      {!isLoading && !isError && banners.length === 0 && (
        <Empty description={m.admin_banner_empty()}>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setEditing({ placement })}>{m.admin_banner_add_first()}</Button>
        </Empty>
      )}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          <ol aria-label={m.admin_banner_list()} className="space-y-2">
            {banners.map((banner, index) => (
              <BannerRow
                key={banner.id}
                banner={banner}
                index={index}
                total={banners.length}
                busy={reorder.isPending || toggle.isPending}
                onEdit={setEditing}
                onDelete={askDelete}
                onMove={move}
                onToggle={(row, active) => toggle.mutate({ banner: row, active })}
              />
            ))}
          </ol>
        </SortableContext>
      </DndContext>

      <BannerFormDrawer
        banner={editing}
        renderPreview={renderPreview}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null)
          refresh()
        }}
      />
      {confirmationModal}
    </div>
  )
}
