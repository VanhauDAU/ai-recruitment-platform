import {
  ArrowRightOutlined,
  CrownFilled,
  LeftOutlined,
  PauseOutlined,
  CaretRightOutlined,
  RightOutlined,
} from '@ant-design/icons'
import { useEffect, useMemo } from 'react'
import { Link } from 'react-router'
import { CvTemplatePreview, templateColors, templatePreviewForColor } from '@/entities/cv/cv-template'
import { m } from '@/shared/config/i18n'
import { useMediaQuery } from '@/shared/hooks/use-media-query'
import { CLOSED, useFlipBook } from '../model/use-flip-book'
import './cv-flipbook.css'

const templateImage = (template) => templatePreviewForColor(template, templateColors(template)[0])

// Máy có chuột: lá sách chia thành các dải nối tiếp từ gáy ra mép, mỗi dải uốn thêm một góc
// nhỏ nên cả lá cong như giấy. Màn cảm ứng dùng lá liền một tấm vì Safari iOS lộ sọc tối/sáng
// nhấp nháy giữa các dải (cv-flipbook.css).
const LEAF_STRIPS = 4

/**
 * Dải thứ `index` của lá sách đang lật và các dải phía ngoài lồng bên trong nó. Mỗi dải
 * hiện đúng phần trang của mình: mặt trước theo trang đang lật, mặt sau theo trang sẽ lộ
 * ra (đã lật ngược nên tính từ phía gáy bên kia).
 */
function LeafStrip({ index, direction, front, back }) {
  if (index >= LEAF_STRIPS) return null
  // Lật tới: gáy ở mép trái trang phải, dải 0 là phần sát gáy. Lật lùi thì ngược lại.
  const nearSpine = direction === 'next' ? index : LEAF_STRIPS - 1 - index
  const farSpine = LEAF_STRIPS - 1 - nearSpine
  return (
    <div className="cv-book__strip">
      <div className="cv-book__slice cv-book__slice--front" style={{ '--slice': nearSpine }}>
        <div className="cv-book__slice-page">{front}</div>
      </div>
      <div className="cv-book__slice cv-book__slice--back" style={{ '--slice': farSpine }}>
        <div className="cv-book__slice-page">{back}</div>
      </div>
      <LeafStrip index={index + 1} direction={direction} front={front} back={back} />
    </div>
  )
}

// Bìa cứng → trang lót → các trang mẫu → trang cuối. Sau bìa là các cặp trái/phải nên tổng
// số trang luôn lẻ.
function buildPages(templates) {
  const pages = [
    { kind: 'cover' },
    { kind: 'intro' },
    ...templates.map((template) => ({ kind: 'template', template })),
    { kind: 'end' },
  ]
  return pages.length % 2 ? pages : [...pages, { kind: 'blank' }]
}

function BookPage({ page, number, count }) {
  if (page.kind === 'cover') {
    return (
      <div className="cv-book__sheet cv-book__sheet--cover">
        <span className="cv-book__cover-frame" aria-hidden="true" />
        <p className="cv-book__cover-title">{m.candidate_cv_book_label()}</p>
        <p className="cv-book__cover-edition">{m.candidate_cv_book_cover_edition({ count })}</p>
        <span className="cv-book__cover-hint cv-book__cover-hint--light">
          {m.candidate_cv_book_open_hint()} <RightOutlined aria-hidden="true" />
        </span>
      </div>
    )
  }
  if (page.kind === 'intro') {
    return (
      <div className="cv-book__sheet cv-book__sheet--intro">
        <span className="cv-book__mark" aria-hidden="true" />
        <p className="cv-book__intro-title">{m.candidate_cv_book_label()}</p>
        <p className="cv-book__cover-lead">{m.candidate_cv_book_cover_lead({ count })}</p>
        <span className="cv-book__cover-hint">{m.candidate_cv_book_cover_hint()} <RightOutlined aria-hidden="true" /></span>
      </div>
    )
  }
  if (page.kind === 'end') {
    return (
      <div className="cv-book__sheet cv-book__sheet--end">
        <p className="cv-book__end-title">{m.candidate_cv_book_end_title()}</p>
        <p className="cv-book__end-lead">{m.candidate_cv_book_end_lead()}</p>
        <Link to="/mau-cv" className="cv-book__end-cta">
          {m.candidate_cv_book_end_cta()} <ArrowRightOutlined aria-hidden="true" />
        </Link>
        <span className="cv-book__folio">{number}</span>
      </div>
    )
  }
  if (page.kind === 'blank') return <div className="cv-book__sheet cv-book__sheet--blank" />

  const { template } = page
  return (
    <Link
      to={`/mau-cv/chi-tiet/${template.slug}`}
      aria-label={m.candidate_cv_book_open({ name: template.display_name })}
      className="cv-book__sheet cv-book__sheet--cv"
      draggable={false}
    >
      <CvTemplatePreview template={template} imageUrl={templateImage(template)} />
      <span className="cv-book__caption">
        <span className="cv-book__name">{template.display_name}</span>
        {template.is_premium && <span className="cv-book__premium"><CrownFilled aria-hidden="true" /> PREMIUM</span>}
      </span>
      <span className="cv-book__folio">{number}</span>
    </Link>
  )
}

/**
 * Mẫu CV trang chủ dạng cuốn sách: lúc đầu đóng, chỉ thấy bìa ở giữa; lật bìa thì sách mở
 * hai trang và trượt ra giữa; hết trang cuối thì gập về bìa. Lá sách lật quanh gáy (chỉ
 * dựng khi đang lật). Mọi cỡ màn hình cùng một cuốn sách (cv-flipbook.css).
 */
export default function CvFlipBook({ templates, loading }) {
  const pages = useMemo(() => buildPages(templates), [templates])
  const {
    bookRef, bookProps, first, turning, playing, canTurn,
    next, prev, open, goTo, finishTurn, togglePlaying, holdAfterTouch,
  } = useFlipBook(loading ? 0 : pages.length)
  const curl = useMediaQuery('(pointer: fine)')
  const total = pages.length
  const render = (index) => (
    index >= 0 && index < total ? <BookPage page={pages[index]} number={index} count={templates.length} /> : null
  )

  // Tải trước ảnh của lần mở kế tiếp để lá sách không lật ra trang trống.
  useEffect(() => {
    for (let index = first + 2; index < first + 6; index += 1) {
      const page = pages[index]
      if (page?.kind === 'template') new Image().src = templateImage(page.template)
    }
  }, [first, pages])

  // Lật tới: trang phải lật sang trái, lộ cặp trang kế. Lật lùi/gập: trang trái lật sang
  // phải; gập về bìa thì mặt sau là bìa và bên trái không còn trang nào.
  const closed = first === CLOSED
  const closing = turning === 'close' || (turning === 'prev' && first === 1)
  const leftIndex = closed || turning === 'close' ? null : turning === 'prev' ? first - 2 : first
  const rightIndex = turning === 'next' ? first + 3 : closed ? 0 : first + 1
  const leafFront = turning === 'next' ? first + 1 : first
  const leafBack = turning === 'next' ? first + 2 : turning === 'close' ? 0 : first - 1
  const progress = closed ? m.candidate_cv_book_cover_label() : `${first + 1}–${first + 2}`
  const progressText = m.candidate_cv_book_progress({ current: progress, total })

  return (
    <div className="cv-book-stage">
      <div
        ref={bookRef}
        className="cv-book"
        data-turning={turning || undefined}
        data-closed={(closed && !turning) || closing || undefined}
        role="region"
        aria-label={m.candidate_cv_book_label()}
        {...bookProps}
      >
        {leftIndex !== null && leftIndex >= 1 && (
          <div className="cv-book__page cv-book__page--left">{render(leftIndex)}</div>
        )}
        <div className="cv-book__page cv-book__page--right">
          {render(rightIndex)}
          {/* Sách đóng: chạm vào bìa là mở, không cần vuốt. */}
          {closed && !turning && (
            <button type="button" className="cv-book__open" onClick={open} aria-label={m.candidate_cv_book_open_label()} />
          )}
        </div>
        {turning && (
          <div
            className={`cv-book__leaf cv-book__leaf--${turning === 'next' ? 'next' : 'prev'}`}
            // Lá sách chạy hai hiệu ứng (xoay, nhấc lên); chỉ hết vòng xoay mới đổi trang, còn
            // animationend của lớp bóng trên hai mặt nổi lên với target khác nên bị bỏ qua.
            onAnimationEnd={(event) => (
              event.target === event.currentTarget && event.animationName !== 'cv-book-lift' && finishTurn()
            )}
            aria-hidden="true"
            inert
          >
            {curl ? (
              <LeafStrip
                index={0}
                direction={turning === 'next' ? 'next' : 'prev'}
                front={render(leafFront)}
                back={render(leafBack)}
              />
            ) : (
              <>
                <div className="cv-book__face cv-book__face--front">{render(leafFront)}</div>
                <div className="cv-book__face cv-book__face--back">{render(leafBack)}</div>
              </>
            )}
          </div>
        )}
      </div>

      <div className="cv-book__bar">
        <button type="button" className="cv-book__button" onClick={() => { holdAfterTouch(); prev() }} disabled={!canTurn || closed} aria-label={m.candidate_cv_book_prev()}>
          <LeftOutlined />
        </button>
        <input
          type="range"
          className="cv-book__range"
          min={CLOSED}
          max={Math.max(CLOSED, total - 2)}
          step={2}
          value={first}
          disabled={!canTurn}
          onChange={(event) => { holdAfterTouch(); goTo(Number(event.target.value)) }}
          aria-label={m.candidate_cv_book_seek()}
          aria-valuetext={progressText}
          style={{ '--progress': `${total > 1 ? ((first + 1) / (total - 1)) * 100 : 0}%` }}
        />
        <span className="cv-book__count">{progressText}</span>
        <button type="button" className="cv-book__button" onClick={togglePlaying} disabled={!canTurn} aria-label={playing ? m.candidate_cv_book_pause() : m.candidate_cv_book_play()}>
          {playing ? <PauseOutlined /> : <CaretRightOutlined />}
        </button>
        <button type="button" className="cv-book__button" onClick={() => { holdAfterTouch(); next() }} disabled={!canTurn} aria-label={m.candidate_cv_book_next()}>
          <RightOutlined />
        </button>
      </div>
    </div>
  )
}
