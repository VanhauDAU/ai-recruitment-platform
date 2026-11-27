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
import { useFlipBook, wrapPage } from '../model/use-flip-book'
import './cv-flipbook.css'

const templateImage = (template) => templatePreviewForColor(template, templateColors(template)[0])

// Bìa → các trang mẫu → trang cuối; số trang chẵn để sách mở hai trang luôn đủ cặp.
function buildPages(templates) {
  const pages = [{ kind: 'cover' }, ...templates.map((template) => ({ kind: 'template', template })), { kind: 'end' }]
  return pages.length % 2 ? [...pages, { kind: 'blank' }] : pages
}

function BookPage({ page, number, count }) {
  if (page.kind === 'cover') {
    return (
      <div className="cv-book__sheet cv-book__sheet--cover">
        <span className="cv-book__mark" aria-hidden="true" />
        <p className="cv-book__cover-title">{m.candidate_cv_book_label()}</p>
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
 * Mẫu CV trang chủ dạng cuốn sách đang lật, lá sách lật quanh gáy (chỉ dựng khi đang lật).
 * Từ sm mở hai trang mỗi lần (step 2). Điện thoại vẫn là sách mở nhưng mỗi lần lật một trang
 * (step 1): trang trái là trang vừa đọc, chỉ ló một dải ở mép trái (cv-flipbook.css).
 */
export default function CvFlipBook({ templates, loading }) {
  const pages = useMemo(() => buildPages(templates), [templates])
  const {
    bookRef, bookProps, first, step, turning, playing, canTurn,
    next, prev, goTo, finishTurn, togglePlaying, holdAfterTouch,
  } = useFlipBook(loading ? 0 : pages.length)
  const total = pages.length
  const render = (index) => {
    const at = wrapPage(index, total)
    return <BookPage page={pages[at]} number={at + 1} count={templates.length} />
  }

  // Tải trước ảnh của lần mở kế tiếp để lá sách không lật ra trang trống.
  useEffect(() => {
    for (let offset = step; offset < step * 3; offset += 1) {
      const page = pages[wrapPage(first + offset, total)]
      if (page?.kind === 'template') new Image().src = templateImage(page.template)
    }
  }, [first, step, pages, total])

  // Hai trang đang mở; lật tới thì trang phải lật sang trái, lật lùi thì trang trái lật sang
  // phải. Mặt sau lá sách là trang sẽ nằm ở phía bên kia sau khi lật xong.
  const left = step === 2 ? first : first - 1
  const right = left + 1
  const leftShown = turning === 'prev' ? left - step : left
  const rightShown = turning === 'next' ? right + step : right
  const leafFront = turning === 'next' ? right : left
  const leafBack = turning === 'next' ? right + step - 1 : left - (step - 1)
  const progress = step === 2 ? `${first + 1}–${first + 2}` : `${first + 1}`

  return (
    <div className="cv-book-stage">
      <div
        ref={bookRef}
        className="cv-book"
        data-step={step}
        data-turning={turning || undefined}
        role="region"
        aria-label={m.candidate_cv_book_label()}
        {...bookProps}
      >
        <div className="cv-book__page cv-book__page--left">{render(leftShown)}</div>
        <div className="cv-book__page cv-book__page--right">{render(rightShown)}</div>
        {turning && (
          <div
            className={`cv-book__leaf cv-book__leaf--${turning}`}
            onAnimationEnd={(event) => event.target === event.currentTarget && finishTurn()}
            aria-hidden="true"
            inert
          >
            <div className="cv-book__face cv-book__face--front">{render(leafFront)}</div>
            <div className="cv-book__face cv-book__face--back">{render(leafBack)}</div>
          </div>
        )}
      </div>

      <div className="cv-book__bar">
        <button type="button" className="cv-book__button" onClick={() => { holdAfterTouch(); prev() }} disabled={!canTurn} aria-label={m.candidate_cv_book_prev()}>
          <LeftOutlined />
        </button>
        <input
          type="range"
          className="cv-book__range"
          min={0}
          max={Math.max(0, total - step)}
          step={step}
          value={first}
          disabled={!canTurn}
          onChange={(event) => { holdAfterTouch(); goTo(Number(event.target.value)) }}
          aria-label={m.candidate_cv_book_seek()}
          aria-valuetext={m.candidate_cv_book_progress({ current: progress, total })}
          style={{ '--progress': `${total > step ? (first / (total - step)) * 100 : 0}%` }}
        />
        <span className="cv-book__count">{m.candidate_cv_book_progress({ current: progress, total })}</span>
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
