import { useEffect, useState } from 'react'
import { AimOutlined, FilterOutlined, SearchOutlined } from '@ant-design/icons'
import { Badge, Button, Checkbox, Drawer, Select } from 'antd'
import { SALARY_RANGES } from '@/entities/job/job'
import { searchGeoPlaces } from '@/entities/system/location'
import { m } from '@/shared/config/i18n'

// Gói miễn phí của Geoapify (GEOCODING_PROVIDER=geoapify) bắt buộc ghi công cạnh
// kết quả; nhận ra qua tiền tố ref của gợi ý nên đổi nhà cung cấp không phải sửa đây.
const PLACE_CREDITS = {
  geoapify: [['https://www.geoapify.com/', 'Geoapify'], ['https://www.openstreetmap.org/copyright', '© OpenStreetMap']],
}
const SEARCH_DELAY_MS = 300
const MIN_QUERY = 2

const GEO_ERROR_MESSAGES = {
  unsupported: () => m.candidate_nearby_geo_unsupported(),
  insecure: () => m.candidate_nearby_geo_insecure(),
  denied: () => m.candidate_nearby_geo_denied(),
  unavailable: () => m.candidate_nearby_geo_unavailable(),
  timeout: () => m.candidate_nearby_geo_timeout(),
  outside: () => m.candidate_nearby_geo_outside(),
  place: () => m.candidate_nearby_place_failed(),
}

function usePlaceSuggestions(query, focus) {
  const [state, setState] = useState({ query: '', options: [], loading: false })
  const text = query.trim()
  const lat = focus?.latitude
  const lng = focus?.longitude

  useEffect(() => {
    if (text.length < MIN_QUERY) return undefined
    const controller = new AbortController()
    const timer = setTimeout(() => {
      setState((prev) => ({ ...prev, loading: true }))
      searchGeoPlaces(text, Number.isFinite(lat) ? { latitude: lat, longitude: lng } : null, { signal: controller.signal })
        .then((options) => setState({ query: text, options, loading: false }))
        .catch(() => {
          if (!controller.signal.aborted) setState({ query: text, options: [], loading: false })
        })
    }, SEARCH_DELAY_MS)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [text, lat, lng])

  if (text.length < MIN_QUERY) return { options: [], loading: false, searched: false }
  return { ...state, searched: state.query === text && !state.loading }
}

function SuggestionLabel({ option }) {
  return (
    <span className="nearby-suggestion">
      <span className="nearby-suggestion__kind">
        {option.type === 'ward' ? m.candidate_nearby_suggest_ward() : m.candidate_nearby_suggest_place()}
      </span>
      <span className="nearby-suggestion__text">
        <span className="nearby-suggestion__label">{option.label}</span>
        {option.secondary && <span className="nearby-suggestion__secondary">{option.secondary}</span>}
      </span>
    </span>
  )
}

export default function NearbyFilterBar({
  filters,
  radiusChoices,
  categories,
  originLabel,
  focus,
  locating,
  geoError,
  onUseLocation,
  onPickPlace,
  onRadiusChange,
  onApply,
  compact = false,
  viewSwitch = null,
}) {
  const [query, setQuery] = useState('')
  const [sheetOpen, setSheetOpen] = useState(false)
  const [draft, setDraft] = useState(filters)
  const suggestions = usePlaceSuggestions(query, focus)
  const credits = PLACE_CREDITS[suggestions.options.find((option) => option.type === 'place')?.ref.split(':')[0]]
  // Đồng bộ bản nháp khi URL đổi (nút quay lại, mở rộng bán kính…).
  const [synced, setSynced] = useState(filters)
  if (synced !== filters) {
    setSynced(filters)
    setDraft(filters)
  }

  const salaryOptions = [
    { value: '', label: m.candidate_nearby_all_salaries() },
    ...SALARY_RANGES.map((range) => ({ value: range.key, label: range.label })),
    { value: 'nego', label: m.candidate_nearby_salary_negotiable() },
  ]
  const categoryOptions = [
    { value: '', label: m.candidate_nearby_all_categories() },
    ...categories.map((category) => ({ value: String(category.id), label: category.name })),
  ]

  const activeFilters = [filters.category, filters.salary, filters.remote].filter(Boolean).length
  // Ngành nghề, lương, từ xa: trên hàng lọc (máy tính) hoặc trong bảng trượt (điện thoại).
  const fields = (
    <>
      <Select
        className="nearby-filter__select"
        value={draft.category}
        options={categoryOptions}
        onChange={(category) => setDraft((prev) => ({ ...prev, category }))}
        aria-label={m.candidate_nearby_all_categories()}
        popupMatchSelectWidth={false}
      />
      <Select
        className="nearby-filter__select"
        value={draft.salary}
        options={salaryOptions}
        onChange={(salary) => setDraft((prev) => ({ ...prev, salary }))}
        aria-label={m.candidate_nearby_all_salaries()}
      />
      <Checkbox
        className="nearby-filter__remote"
        checked={draft.remote}
        onChange={(event) => setDraft((prev) => ({ ...prev, remote: event.target.checked }))}
      >
        {m.candidate_nearby_include_remote()}
      </Checkbox>
    </>
  )

  return (
    <section className="nearby-filter" aria-label={m.candidate_nearby_title()}>
      {/* Một ô vị trí: gõ tìm phường/xã, địa chỉ; nút ngắm bên phải điền vị trí hiện tại vào ô. */}
      <div className="nearby-filter__origin">
        <Select
          showSearch
          size="large"
          className="nearby-filter__place"
          prefix={<SearchOutlined aria-hidden />}
          value={originLabel || null}
          placeholder={locating ? m.candidate_nearby_locating() : m.candidate_nearby_place_placeholder()}
          filterOption={false}
          onSearch={setQuery}
          searchValue={query}
          loading={suggestions.loading}
          popupRender={(menu) => (
            <>
              {menu}
              {credits && (
                <p className="nearby-filter__credit">
                  {m.candidate_nearby_place_credit()}
                  {credits.map(([href, label]) => (
                    <a key={href} href={href} target="_blank" rel="noopener noreferrer">{label}</a>
                  ))}
                </p>
              )}
            </>
          )}
          notFoundContent={suggestions.searched
            ? <p className="nearby-filter__empty">{m.candidate_nearby_place_not_found()}</p>
            : null}
          options={suggestions.options.map((option) => ({
            value: option.ref,
            label: <SuggestionLabel option={option} />,
            option,
          }))}
          onSelect={(_, item) => {
            setQuery('')
            onPickPlace(item.option)
          }}
          aria-label={m.candidate_nearby_place_placeholder()}
        />
        <Button
          type="primary"
          size="large"
          icon={<AimOutlined />}
          loading={locating}
          onClick={onUseLocation}
          className="nearby-filter__locate"
          aria-label={m.candidate_nearby_use_location()}
          title={m.candidate_nearby_use_location()}
        >
          <span className="nearby-filter__locate-text">{m.candidate_nearby_use_location()}</span>
        </Button>
      </div>
      {geoError && <p className="nearby-filter__error" role="alert">{GEO_ERROR_MESSAGES[geoError]?.()}</p>}
      {compact ? (
        // Điện thoại: một hàng — bán kính, nút mở bộ lọc phụ, chuyển danh sách/bản đồ.
        <div className="nearby-filter__compact">
          <Select
            className="nearby-filter__radius-select"
            value={filters.radius}
            options={radiusChoices.map((km) => ({ value: km, label: m.candidate_nearby_radius_option({ km }) }))}
            onChange={onRadiusChange}
            aria-label={m.candidate_nearby_radius()}
            popupMatchSelectWidth={false}
          />
          <Badge count={activeFilters} size="small" color="var(--brand-primary)">
            <Button icon={<FilterOutlined />} onClick={() => setSheetOpen(true)}>
              {m.candidate_nearby_filters()}
            </Button>
          </Badge>
          {viewSwitch}
        </div>
      ) : (
        <div className="nearby-filter__row">
          <span className="nearby-filter__label" aria-hidden>{m.candidate_nearby_radius()}</span>
          <div className="nearby-filter__radius" role="radiogroup" aria-label={m.candidate_nearby_radius()}>
            {radiusChoices.map((km) => (
              <button
                key={km}
                type="button"
                role="radio"
                aria-checked={filters.radius === km}
                className={`nearby-chip${filters.radius === km ? ' nearby-chip--active' : ''}`}
                onClick={() => onRadiusChange(km)}
              >
                {m.candidate_nearby_radius_option({ km })}
              </button>
            ))}
          </div>
          {fields}
          <Button type="primary" ghost className="nearby-filter__submit" onClick={() => onApply(draft)}>
            {m.candidate_nearby_search()}
          </Button>
        </div>
      )}
      {compact && (
        <Drawer
          placement="bottom"
          size="auto"
          open={sheetOpen}
          onClose={() => setSheetOpen(false)}
          title={m.candidate_nearby_filters()}
          footer={(
            <Button
              type="primary"
              size="large"
              block
              onClick={() => {
                setSheetOpen(false)
                onApply(draft)
              }}
            >
              {m.candidate_nearby_show_results()}
            </Button>
          )}
        >
          <div className="nearby-filter__sheet">{fields}</div>
        </Drawer>
      )}
    </section>
  )
}
