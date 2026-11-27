import { AppstoreOutlined, ArrowRightOutlined } from '@ant-design/icons'
import { useMemo } from 'react'
import { Link } from 'react-router'
import { formatNumber } from '@/entities/job/job'
import { m } from '@/shared/config/i18n'
import ArrowButton from '@/shared/ui/ArrowButton'
import { categoryLogoUrlFor } from '../lib/logo-url'
import { chunkItems, usePagedDrag } from '../model/use-paged-drag'
import { PagedTrack } from './PagedCarousel'
import './home-showcase.css'

const INDUSTRIES_PER_PAGE = 8

export default function FeaturedIndustries({ industries, navigate }) {
  const groups = useMemo(() => chunkItems(industries, INDUSTRIES_PER_PAGE), [industries])
  const carousel = usePagedDrag(groups.length)
  if (industries.length === 0) return null

  return (
    <section aria-labelledby="featured-industries-title" className="home-showcase">
      <div className="home-showcase__header">
        <div className="min-w-0">
          <h2 id="featured-industries-title" className="home-showcase__title">Top ngành nghề nổi bật</h2>
          <p className="home-showcase__subtitle">{m.candidate_home_industries_subtitle()}</p>
        </div>
        <div className="home-showcase__actions">
          <Link to="/viec-lam" className="home-showcase__more">
            {m.candidate_home_industries_view_all()} <ArrowRightOutlined aria-hidden="true" />
          </Link>
          {groups.length > 1 && (
            <>
              <ArrowButton
                dir="left"
                disabled={!carousel.canPrev}
                onClick={carousel.goPrev}
                aria-label="Nhóm ngành nghề trước"
                className="home-showcase__nav"
              />
              <ArrowButton
                dir="right"
                disabled={!carousel.canNext}
                onClick={carousel.goNext}
                aria-label="Nhóm ngành nghề tiếp theo"
                className="home-showcase__nav"
              />
            </>
          )}
        </div>
      </div>

      <div
        className="cursor-grab select-none active:cursor-grabbing"
        {...carousel.dragHandlers}
      >
        <PagedTrack
          groups={groups}
          page={carousel.page}
          dragOffset={carousel.dragOffset}
          isDragging={carousel.isDragging}
        >
          {(group) => (
            <div data-reveal-stagger className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {group.map((category) => {
                const logoUrl = categoryLogoUrlFor(category)
                return (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => navigate(`/viec-lam?cat=${category.id}`)}
                    className="home-showcase__card featured-industries__card"
                  >
                    <span className="featured-industries__icon" aria-hidden="true">
                      {logoUrl
                        ? <img src={logoUrl} alt="" loading="lazy" draggable={false} />
                        : <AppstoreOutlined />}
                    </span>
                    <span className="home-showcase__name">{category.name}</span>
                    <span className="home-showcase__count">{formatNumber(category.count)} việc làm</span>
                  </button>
                )
              })}
            </div>
          )}
        </PagedTrack>
      </div>

      {groups.length > 1 && (
        <div className="home-showcase__dots" aria-hidden="true">
          {groups.map((_, index) => (
            <span key={index} className={`home-showcase__dot${index === carousel.page ? ' is-active' : ''}`} />
          ))}
        </div>
      )}
    </section>
  )
}
