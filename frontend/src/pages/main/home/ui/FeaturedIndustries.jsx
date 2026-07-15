import { useMemo } from 'react'
import { formatNumber } from '@/entities/job'
import { categoryLogoUrlFor } from '../lib/logo-url'
import { chunkItems, usePagedDrag } from '../model/use-paged-drag'
import { CarouselHeader, PagedTrack } from './PagedCarousel'

const INDUSTRIES_PER_PAGE = 8

export default function FeaturedIndustries({ industries, navigate }) {
  const groups = useMemo(() => chunkItems(industries, INDUSTRIES_PER_PAGE), [industries])
  const carousel = usePagedDrag(groups.length)

  if (industries.length === 0) return null

  return (
    <div>
      <CarouselHeader
        title="Top ngành nghề nổi bật"
        carousel={carousel}
        totalPages={groups.length}
        prevLabel="Nhóm ngành nghề trước"
        nextLabel="Nhóm ngành nghề tiếp theo"
      />

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
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {group.map((category) => {
                const logoUrl = categoryLogoUrlFor(category)
                return (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => navigate(`/viec-lam?cat=${category.id}`)}
                    className="group flex min-h-[156px] cursor-pointer flex-col items-center justify-center rounded-lg border border-transparent bg-[#F4F5F7] px-5 py-6 text-center transition hover:-translate-y-1 hover:border-[var(--brand-primary)] hover:bg-white hover:shadow-md hover:shadow-emerald-100"
                  >
                    {logoUrl && (
                      <span className="mb-5 flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl bg-white p-2 shadow-sm transition group-hover:scale-105 group-hover:border group-hover:border-emerald-100">
                        <img
                          src={logoUrl}
                          alt={category.name}
                          className="max-h-full max-w-full object-contain"
                          loading="lazy"
                          draggable={false}
                        />
                      </span>
                    )}
                    <span className="line-clamp-1 text-sm font-bold text-gray-800">{category.name}</span>
                    <span className="mt-2 text-xs font-medium text-[var(--brand-primary)]">
                      {formatNumber(category.count)} việc làm
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </PagedTrack>
      </div>
    </div>
  )
}
