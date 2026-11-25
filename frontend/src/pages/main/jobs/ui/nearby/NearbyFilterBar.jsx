import { useEffect, useState } from 'react'
import { AimOutlined } from '@ant-design/icons'
import { Button, Checkbox, Select } from 'antd'
import { SALARY_RANGES } from '@/entities/job/job'
import { searchGeoPlaces } from '@/entities/system/location'
import { m } from '@/shared/config/i18n'

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

  return text.length < MIN_QUERY ? { options: [], loading: false } : state
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
}) {
  const [query, setQuery] = useState('')
  const [draft, setDraft] = useState(filters)
  const suggestions = usePlaceSuggestions(query, focus)
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

  return (
    <section className="nearby-filter" aria-label={m.candidate_nearby_title()}>
      <div className="nearby-filter__origin">
        <Button
          type="primary"
          size="large"
          icon={<AimOutlined />}
          loading={locating}
          onClick={onUseLocation}
          className="nearby-filter__locate"
        >
          {m.candidate_nearby_use_location()}
        </Button>
        <span className="nearby-filter__or">{m.candidate_nearby_or()}</span>
        <Select
          showSearch
          size="large"
          className="nearby-filter__place"
          value={originLabel || null}
          placeholder={m.candidate_nearby_place_placeholder()}
          filterOption={false}
          onSearch={setQuery}
          searchValue={query}
          loading={suggestions.loading}
          notFoundContent={null}
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
      </div>
      {geoError && <p className="nearby-filter__error" role="alert">{GEO_ERROR_MESSAGES[geoError]?.()}</p>}
      <div className="nearby-filter__row">
        <span className="nearby-filter__label">{m.candidate_nearby_radius()}</span>
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
          checked={draft.remote}
          onChange={(event) => setDraft((prev) => ({ ...prev, remote: event.target.checked }))}
        >
          {m.candidate_nearby_include_remote()}
        </Checkbox>
        <Button className="nearby-filter__submit" onClick={() => onApply(draft)}>
          {m.candidate_nearby_search()}
        </Button>
      </div>
    </section>
  )
}
