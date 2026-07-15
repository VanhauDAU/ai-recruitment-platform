import { useMemo } from 'react'
import { logoUrlFor } from '../lib/logo-url'
import { chunkItems, usePagedDrag } from '../model/use-paged-drag'
import EmployerLogoBelt from './EmployerLogoBelt'
import { CarouselHeader, PagedTrack } from './PagedCarousel'

const EMPLOYERS_PER_PAGE = 5

export default function FeaturedEmployers({ employers, navigate }) {
  const groups = useMemo(() => chunkItems(employers, EMPLOYERS_PER_PAGE), [employers])
  const carousel = usePagedDrag(groups.length)

  if (employers.length === 0) return null

  return (
    <div className="mt-8">
      <CarouselHeader
        title="Nhà tuyển dụng nổi bật"
        carousel={carousel}
        totalPages={groups.length}
        prevLabel="Nhóm nhà tuyển dụng trước"
        nextLabel="Nhóm nhà tuyển dụng tiếp theo"
      />

      <style>{`
        .emp-card {
          position: relative;
          overflow: hidden;
          transition: transform 0.25s cubic-bezier(0.22,1,0.36,1), box-shadow 0.25s ease;
        }
        .emp-card::before {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, rgba(0,177,79,0.07) 0%, rgba(61,220,132,0.04) 60%);
          opacity: 0;
          transition: opacity 0.25s ease;
          pointer-events: none;
          border-radius: inherit;
        }
        .emp-card:hover { transform: translateY(-5px); box-shadow: 0 16px 40px rgba(0,177,79,0.12), 0 4px 12px rgba(0,0,0,0.06); }
        .emp-card:hover::before { opacity: 1; }
        .emp-card-accent {
          position: absolute;
          bottom: 0; left: 0; right: 0;
          height: 3px;
          background: linear-gradient(90deg, var(--brand-primary), #3ddc84);
          transform: scaleX(0);
          transform-origin: left;
          transition: transform 0.3s ease;
          border-radius: 0 0 16px 16px;
        }
        .emp-card:hover .emp-card-accent { transform: scaleX(1); }
      `}</style>

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
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
              {group.map((employer, idx) => (
                <button
                  key={employer.public_id}
                  type="button"
                  onClick={() => navigate(`/viec-lam?search=${encodeURIComponent(employer.company_name)}&search_by=company`)}
                  className="emp-card group flex items-center justify-center rounded-2xl bg-[#f8faf8] px-6 py-8 cursor-pointer"
                  style={{ minHeight: idx % 3 === 0 ? 130 : 110 }}
                >
                  <img
                    src={logoUrlFor(employer)}
                    alt={employer.company_name}
                    className="object-contain transition-transform duration-300 group-hover:scale-110"
                    style={{ width: idx % 3 === 0 ? 96 : 80, height: idx % 3 === 0 ? 96 : 80 }}
                    loading="lazy"
                    draggable={false}
                  />
                  <div className="emp-card-accent" />
                </button>
              ))}
            </div>
          )}
        </PagedTrack>
      </div>

      <EmployerLogoBelt employers={employers} navigate={navigate} />
    </div>
  )
}
