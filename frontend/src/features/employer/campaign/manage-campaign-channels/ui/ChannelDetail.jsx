import { DeleteOutlined, MoreOutlined } from '@ant-design/icons'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { App, Button, Dropdown, Tabs } from 'antd'
import { campaignKeys, ChannelIcon, deleteCampaignChannel } from '@/entities/campaign/campaign'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { message } from '@/shared/lib/toast'
import HelpTip from '@/shared/ui/HelpTip'
import { money } from '../lib/channel-kinds'
import { CHANNEL_METRIC_HELP as HELP } from '../lib/metric-help'
import ChannelCostsPanel from './ChannelCostsPanel'
import ChannelLinkSection from './ChannelLinkSection'
import ChannelPostSection from './ChannelPostSection'
import { getIntlLocale, m } from '@/shared/config/i18n'

const rate = (part, whole) => (whole ? `${((part * 100) / whole).toLocaleString(getIntlLocale(), { maximumFractionDigits: 1 })}%` : '—')

export default function ChannelDetail({ campaign, channel, editable }) {
  const queryClient = useQueryClient()
  const { modal } = App.useApp()
  const remove = useMutation({
    mutationFn: () => deleteCampaignChannel(campaign.public_id, channel.public_id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: campaignKeys.channels(campaign.public_id) })
      queryClient.invalidateQueries({ queryKey: campaignKeys.channelReport(campaign.public_id) })
      message.success(m.employer_campaign_channel_deleted({ label: channel.label }))
    },
    onError: (error) => message.error(getApiErrorMessage(error, m.employer_campaign_channel_delete_error())),
  })
  const sections = [
    { key: 'post', label: m.employer_campaign_channel_tab_content(), children: <ChannelPostSection campaign={campaign} channel={channel} editable={editable} /> },
    { key: 'link', label: m.employer_campaign_channel_tab_link(), children: <ChannelLinkSection channel={channel} /> },
    { key: 'costs', label: m.employer_campaign_channel_tab_costs(), children: <ChannelCostsPanel campaign={campaign} channel={channel} editable={editable} /> },
  ]

  return (
    <section className="ch-detail" aria-labelledby={`channel-${channel.public_id}`}>
      <header className="ch-detail__head">
        <ChannelIcon kind={channel.kind} size="lg" />
        <div className="ch-detail__title">
          <h3 id={`channel-${channel.public_id}`}>{channel.label}</h3>
          <span>{channel.kind_label}{channel.posted_at ? m.employer_campaign_channel_posted_suffix() : m.employer_campaign_channel_not_posted_suffix()}</span>
        </div>
        {editable && (
          <Dropdown
            trigger={['click']}
            menu={{
              items: [
                { key: 'delete', icon: <DeleteOutlined />, label: m.employer_campaign_channel_delete(), danger: true },
              ],
              onClick: ({ key }) => {
                if (key === 'delete') {
                  modal.confirm({
                    title: m.employer_campaign_channel_delete_confirm({ label: channel.label }),
                    content: m.employer_campaign_channel_delete_confirm_content(),
                    okText: m.employer_campaign_channel_delete(),
                    okButtonProps: { danger: true },
                    cancelText: m.employer_campaign_channel_keep(),
                    onOk: () => remove.mutateAsync(),
                  })
                }
              },
            }}
          >
            <Button type="text" icon={<MoreOutlined />} aria-label={m.employer_campaign_channel_actions_aria({ label: channel.label })} />
          </Dropdown>
        )}
      </header>

      <dl className="ch-kpis">
        <div><dt>{m.employer_campaign_channel_clickers()}<HelpTip label={m.employer_campaign_channel_clickers_help_label()}>{HELP.clicks}</HelpTip></dt><dd>{channel.unique_clicks.toLocaleString(getIntlLocale())}</dd></div>
        <div><dt>{m.employer_campaign_channel_applications()}<HelpTip label={m.employer_campaign_channel_applications_help_label()}>{m.employer_campaign_channel_applications_help({ applications: HELP.applications, rate: HELP.applyRate })}</HelpTip></dt><dd>{channel.applications}</dd><span>{m.employer_campaign_channel_rate_of_clickers({ rate: rate(channel.applications, channel.unique_clicks) })}</span></div>
        <div><dt>{m.employer_campaign_funnel_accepted()}<HelpTip label={m.employer_campaign_channel_hires_help_label()}>{HELP.hires}</HelpTip></dt><dd>{channel.hires}</dd></div>
        <div><dt>{m.employer_campaign_channel_spent()}<HelpTip label={m.employer_campaign_channel_spent_help_label()}>{HELP.spent}</HelpTip></dt><dd>{money(channel.cost)}</dd></div>
      </dl>

      <Tabs className="ch-tabs" items={sections} destroyOnHidden />
    </section>
  )
}
