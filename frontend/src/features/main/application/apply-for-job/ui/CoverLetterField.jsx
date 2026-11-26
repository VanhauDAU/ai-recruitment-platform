import { FormOutlined } from '@ant-design/icons'
import { Input } from 'antd'
import { memo, useState } from 'react'

/**
 * Thư giới thiệu giữ chữ đang gõ trong state riêng, chỉ báo giá trị mới nhất qua
 * `valueRef` cho lúc nộp (form đổi `key` để làm rỗng): mỗi phím gõ chỉ vẽ lại ô này, không vẽ lại cả modal
 * (danh sách CV, chọn địa điểm, các ô đồng ý) — trước đây làm gõ giật trên điện thoại.
 */
function CoverLetterField({ valueRef, lastCoverLetter }) {
  const [value, setValue] = useState('')
  const change = (next) => {
    valueRef.current = next
    setValue(next)
  }

  return (
    <section className="af-section" aria-labelledby="cover-letter-heading">
      <div className="af-cover-head">
        <h3 id="cover-letter-heading" className="af-heading">
          <FormOutlined className="af-heading__icon" /> Thư giới thiệu
        </h3>
        {lastCoverLetter && value.trim() !== lastCoverLetter && (
          <button type="button" className="af-link" onClick={() => change(lastCoverLetter)}>
            Sử dụng thư giới thiệu gần nhất
          </button>
        )}
      </div>
      <Input.TextArea
        aria-label="Thư giới thiệu"
        className="af-control"
        value={value}
        onChange={(event) => change(event.target.value)}
        maxLength={10000}
        rows={3}
        placeholder="Giới thiệu ngắn gọn về bản thân (điểm mạnh, điểm yếu) và lý do bạn muốn ứng tuyển vị trí này. Không bắt buộc."
      />
    </section>
  )
}

export default memo(CoverLetterField)
