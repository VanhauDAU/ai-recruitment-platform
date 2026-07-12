import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { saveHistory } from '@/components/ui/searchDropdownHistory'
import { SALARY_RANGES } from '@/entities/job'
import {
  FILTER_KEYS,
  SALARY_UNIT,
  SAVED_FILTER_KEY,
  decodeSalary,
  encodeSalary,
  getCommaList,
  getLocationIds,
  mergeSearchParams,
  pathForLocation,
  removeSearchParams,
  replaceCommaParam,
  replaceLocationParams,
} from '../utils/jobListParams'

// Toàn bộ state bộ lọc của trang việc làm sống trên URL (share link được,
// back/forward đúng). Hook này là nơi duy nhất đọc/ghi các param đó;
// JobList chỉ ghép UI và truyền action xuống các khối con.
export default function useJobListFilters(provinces) {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const [keyword, setKeyword] = useState(searchParams.get('search') || '')
  // Khoảng lương tự nhập là draft cục bộ, chỉ đẩy lên URL khi bấm Áp dụng.
  const [salaryFrom, setSalaryFrom] = useState(null)
  const [salaryTo, setSalaryTo] = useState(null)

  const page = Number(searchParams.get('page') || 1)
  const selectedLocations = getLocationIds(searchParams)
  const selectedCategories = getCommaList(searchParams, 'cat').map(Number)
  const searchBy = searchParams.get('search_by') || 'title'
  const ordering = searchParams.get('sort') || ''
  const expYears = getCommaList(searchParams, 'exp')
  const searchParamKeyword = searchParams.get('search') || ''
  const hasFilters = FILTER_KEYS.some((key) => searchParams.has(key))

  // Ô input đồng bộ theo URL (back/forward, xoá filter từ nơi khác).
  useEffect(() => {
    setKeyword(searchParamKeyword)
  }, [searchParamKeyword])

  const salaryDec = decodeSalary(searchParams.get('salary'))
  const matchedRange = SALARY_RANGES.find(
    (range) => (range.gte ?? null) === (salaryDec?.gte ?? null) && (range.lte ?? null) === (salaryDec?.lte ?? null),
  )
  const salaryKey = salaryDec?.nego
    ? 'nego'
    : matchedRange
      ? matchedRange.key
      : salaryDec?.gte || salaryDec?.lte
        ? 'custom'
        : ''

  function updateParams(entries) {
    setSearchParams(mergeSearchParams(searchParams, entries))
  }

  function setCommaParam(key, values) {
    setSearchParams(replaceCommaParam(searchParams, key, values))
  }

  function setLocationParam(ids) {
    const next = replaceLocationParams(searchParams, ids, {
      keyword: keyword.trim(),
      searchBy,
    })
    const pathname = pathForLocation(ids, provinces)
    const query = next.toString()
    navigate(query ? `${pathname}?${query}` : pathname)
  }

  function selectSuggestedLocation(provinceName) {
    const province = provinces.find((item) => item.name.includes(provinceName))
    if (!province) return
    setLocationParam([province.id])
  }

  function toggleExperienceYears(value) {
    setCommaParam('exp', expYears.includes(value) ? expYears.filter((item) => item !== value) : [...expYears, value])
  }

  const toggleParam = (key, value) => updateParams({ [key]: searchParams.get(key) === value ? null : value })

  function runSearch(nextKeyword = keyword, by = searchBy) {
    saveHistory(nextKeyword, by)
    updateParams({ search: nextKeyword.trim() || null, search_by: by === 'title' ? null : by })
  }

  function handleDropdownSelect(nextKeyword, by = searchBy) {
    setKeyword(nextKeyword)
    runSearch(nextKeyword, by)
  }

  // Bấm "x" (hoặc xoá hết chữ) khi đang có search trên URL -> xoá filter ngay, không cần bấm Enter.
  function handleKeywordChange(value) {
    setKeyword(value)
    if (!value && searchParams.get('search')) runSearch('')
  }

  function onSalaryChange(key) {
    if (!key) return updateParams({ salary: null })
    if (key === 'nego') return updateParams({ salary: 'nego' })
    const range = SALARY_RANGES.find((item) => item.key === key)
    return updateParams({ salary: encodeSalary(range?.gte, range?.lte) })
  }

  function applyCustomSalary() {
    updateParams({
      salary: encodeSalary(salaryFrom ? salaryFrom * SALARY_UNIT : null, salaryTo ? salaryTo * SALARY_UNIT : null),
    })
  }

  function clearFilters() {
    setSearchParams(removeSearchParams(searchParams, [...FILTER_KEYS, 'page']))
    setSalaryFrom(null)
    setSalaryTo(null)
  }

  // Empty-state "Xóa bộ lọc & từ khóa": reset cả filter lẫn search về danh sách đầy đủ.
  function clearAllCriteria() {
    setSearchParams(removeSearchParams(
      searchParams,
      [...FILTER_KEYS, 'search', 'search_by', 'page'],
    ))
    setKeyword('')
    setSalaryFrom(null)
    setSalaryTo(null)
  }

  function persistFilter() {
    localStorage.setItem(SAVED_FILTER_KEY, searchParams.toString())
  }

  function handlePageChange(nextPage) {
    const next = new URLSearchParams(searchParams)
    next.set('page', nextPage)
    setSearchParams(next)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return {
    applyCustomSalary,
    clearAllCriteria,
    clearFilters,
    expYears,
    handleDropdownSelect,
    handleKeywordChange,
    handlePageChange,
    hasFilters,
    keyword,
    onSalaryChange,
    ordering,
    page,
    persistFilter,
    runSearch,
    salaryFrom,
    salaryKey,
    salaryTo,
    searchBy,
    searchParamKeyword,
    searchParams,
    selectSuggestedLocation,
    selectedCategories,
    selectedLocations,
    setCommaParam,
    setLocationParam,
    setSalaryFrom,
    setSalaryTo,
    toggleExperienceYears,
    toggleParam,
    updateParams,
  }
}
