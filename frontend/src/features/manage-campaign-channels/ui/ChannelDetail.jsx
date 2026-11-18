import { DeleteOutlined, EditOutlined, MoreOutlined } from '@ant-design/icons'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { App, Button, Dropdown, Tabs } from 'antd'
import { campaignKeys, deleteCampaignChannel } from '@/entities/campaign'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { message } from '@/shared/lib/toast'
import { money } from '../lib/channel-kinds'
import ChannelIcon from './ChannelIcon'
import ChannelContentSection from './ChannelContentSection'
import ChannelCostsPanel from './ChannelCostsPanel'
import ChannelFacebookPosts from './ChannelFacebookPosts'
import ChannelLinkSection from './ChannelLinkSection'

const rate = (part, whole) => (whole ? `${((part * 100) / whole).toLocaleString('vi-VN', { maximumFractionDigits: 1 })}%` : '—')

export default function ChannelDetail({ campaign, channel, editable, onEditContent }) {
  const queryClient = useQueryClient()
  const { modal } = App.useApp()
  const remove = useMutation({
    mutationFn: () => deleteCampaignChannel(campaign.public_id, channel.public_id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: campaignKeys.channels(campaign.public_id) })
      queryClient.invalidateQueries({ queryKey: campaignKeys.channelReport(campaign.public_id) })
      message.success(`Đã xóa kênh "${channel.label}".`)
    },
    onError: (error) => message.error(getApiErrorMessage(error, 'Không thể xóa kênh.')),
  })
  const facebook = channel.kind === 'facebook_page'
  const sections = [
    { key: 'content', label: 'Nội dung bài', children: <ChannelContentSection campaign={campaign} channel={channel} editable={editable} onEditContent={onEditContent} /> },
    facebook && { key: 'facebook', label: 'Đăng Fanpage', children: <ChannelFacebookPosts campaign={campaign} channel={channel} editable={editable} /> },
    { key: 'link', label: 'Link & QR', children: <ChannelLinkSection channel={channel} /> },
    { key: 'costs', label: 'Chi phí', children: <ChannelCostsPanel campaign={campaign} channel={channel} editable={editable} /> },
  ].filter(Boolean)

  return (
    <section className="ch-detail" aria-labelledby={`channel-${channel.public_id}`}>
      <header className="ch-detail__head">
        <ChannelIcon kind={channel.kind} size="lg" />
        <div className="ch-detail__title">
          <h3 id={`channel-${channel.public_id}`}>{channel.label}</h3>
          <span>{channel.kind_label}{channel.posted_at ? ', đã đăng' : ', chưa đăng'}</span>
        </div>
        {editable && (
          <Dropdown
            trigger={['click']}
            menu={{
              items: [
                { key: 'content', icon: <EditOutlined />, label: 'Sửa nội dung' },
                { key: 'delete', icon: <DeleteOutlined />, label: 'Xóa kênh', danger: true },
              ],
              onClick: ({ key }) => {
                if (key === 'content') onEditContent(channel)
                if (key === 'delete') {
                  modal.confirm({
                    title: `Xóa kênh "${channel.label}"?`,
                    content: 'Link theo dõi ngừng hoạt động. Hồ sơ đã nhận vẫn giữ nguồn là loại kênh này.',
                    okText: 'Xóa kênh',
                    okButtonProps: { danger: true },
                    cancelText: 'Giữ lại',
                    onOk: () => remove.mutateAsync(),
                  })
                }
              },
            }}
          >
            <Button type="text" icon={<MoreOutlined />} aria-label={`Thao tác với kênh ${channel.label}`} />
          </Dropdown>
        )}
      </header>

      <dl className="ch-kpis">
        <div><dt>Người bấm link</dt><dd>{channel.unique_clicks.toLocaleString('vi-VN')}</dd></div>
        <div><dt>Hồ sơ nộp</dt><dd>{channel.applications}</dd><span>{rate(channel.applications, channel.unique_clicks)} người bấm</span></div>
        <div><dt>Trúng tuyển</dt><dd>{channel.hires}</dd></div>
        <div><dt>Đã chi</dt><dd>{money(channel.cost)}</dd></div>
      </dl>

      <Tabs className="ch-tabs" items={sections} destroyOnHidden />
    </section>
  )
}
