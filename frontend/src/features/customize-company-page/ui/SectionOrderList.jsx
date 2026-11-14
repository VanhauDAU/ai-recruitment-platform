import { ArrowDownOutlined, ArrowUpOutlined, HolderOutlined, LockOutlined } from '@ant-design/icons'
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Button, Switch, Tag } from 'antd'

function SectionRow({ section, hidden, empty, disabled, onToggle, moves, handle, rowRef, style, dragging }) {
  return (
    <li ref={rowRef} style={style} className={`company-section-row ${dragging ? 'company-section-row--dragging' : ''}`}>
      {handle}
      <div className="company-section-row__body">
        <span className="company-section-row__title">{section.title}</span>
        {empty && <Tag>Chưa có nội dung</Tag>}
      </div>
      {moves && (
        <>
          <Button size="small" type="text" icon={<ArrowUpOutlined />} aria-label={`Chuyển ${section.title} lên`} disabled={disabled || !moves.up} onClick={moves.up} />
          <Button size="small" type="text" icon={<ArrowDownOutlined />} aria-label={`Chuyển ${section.title} xuống`} disabled={disabled || !moves.down} onClick={moves.down} />
        </>
      )}
      {section.always_on ? (
        <span className="company-section-row__lock"><LockOutlined aria-hidden="true" /> Luôn hiển thị</span>
      ) : (
        <Switch
          size="small"
          checked={!hidden}
          disabled={disabled}
          aria-label={`Hiển thị ${section.title}`}
          onChange={(checked) => onToggle(section.key, checked)}
        />
      )}
    </li>
  )
}

function SortableSectionRow(props) {
  const { setNodeRef, transform, transition, listeners, isDragging } = useSortable({
    id: props.section.key,
    disabled: props.disabled,
  })
  return (
    <SectionRow
      {...props}
      rowRef={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      dragging={isDragging}
      // Tay nắm chỉ dành cho chuột/cảm ứng; bàn phím dùng hai nút mũi tên.
      handle={<span className="company-section-row__handle" aria-hidden="true" {...listeners}><HolderOutlined /></span>}
    />
  )
}

/**
 * Thứ tự và hiển thị các khối của trang công ty. `sections` là registry;
 * `order` chỉ gồm khối cột chính (kéo thả hoặc nút mũi tên), khối sidebar giữ
 * thứ tự cố định. `onChange` nhận phần bố cục thay đổi.
 */
export default function SectionOrderList({ sections, order, hidden, contentKeys, disabled = false, onChange }) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))
  const main = order.map((key) => sections.find((section) => section.key === key)).filter(Boolean)
  const sidebar = sections.filter((section) => section.zone === 'sidebar')
  const move = (fromKey, toKey) => onChange({
    section_order: arrayMove(order, order.indexOf(fromKey), order.indexOf(toKey)),
  })
  const rowProps = (section) => ({
    section,
    disabled,
    hidden: hidden.includes(section.key),
    empty: !contentKeys.has(section.key),
    onToggle: (key, visible) => onChange({
      hidden_sections: visible ? hidden.filter((item) => item !== key) : [...hidden, key],
    }),
  })

  return (
    <div className="company-section-groups">
      <div>
        <h3 className="company-layout-subheading">Cột chính</h3>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={({ active, over }) => { if (over && active.id !== over.id) move(active.id, over.id) }}
        >
          <SortableContext items={main.map((section) => section.key)} strategy={verticalListSortingStrategy}>
            <ol className="company-section-list" aria-label="Khối cột chính">
              {main.map((section, index) => (
                <SortableSectionRow
                  key={section.key}
                  {...rowProps(section)}
                  moves={{
                    up: index > 0 ? () => move(section.key, main[index - 1].key) : null,
                    down: index < main.length - 1 ? () => move(section.key, main[index + 1].key) : null,
                  }}
                />
              ))}
            </ol>
          </SortableContext>
        </DndContext>
      </div>
      {sidebar.length > 0 && (
        <div>
          <h3 className="company-layout-subheading">Cột bên (thứ tự cố định)</h3>
          <ul className="company-section-list" aria-label="Khối cột bên">
            {sidebar.map((section) => <SectionRow key={section.key} {...rowProps(section)} />)}
          </ul>
        </div>
      )}
    </div>
  )
}
