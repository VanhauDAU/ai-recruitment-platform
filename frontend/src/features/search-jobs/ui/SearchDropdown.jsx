import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { jobDetailPath } from '@/entities/job'
import useDropdownPosition from '../model/use-dropdown-position'
import useSearchSuggestions from '../model/use-search-suggestions'
import useSuggestedJobs from '../model/use-suggested-jobs'
import KeywordSuggestions from './KeywordSuggestions'
import SearchHistorySection from './SearchHistorySection'
import SuggestedJobsSection from './SuggestedJobsSection'

export default function SearchDropdown({ open, onClose, onSelect, keyword = '', searchBy = 'title', onSearchByChange, wrapperRef }) {
  const navigate = useNavigate()
  const dropdownRef = useRef(null)
  const position = useDropdownPosition({ anchorRef: wrapperRef, isOpen: open })
  const { suggestions } = useSearchSuggestions({ isOpen: open, keyword, searchBy })
  const { jobs, loading } = useSuggestedJobs({ isOpen: open, keyword, searchBy })

  useEffect(() => {
    if (!open) return undefined
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target) && wrapperRef?.current && !wrapperRef.current.contains(event.target)) onClose()
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose, open, wrapperRef])

  if (!open || !position) return null

  function selectSuggestedJob(job) {
    onClose()
    navigate(jobDetailPath(job))
  }

  return createPortal(
    <div
      ref={dropdownRef}
      className="fixed z-[100] overflow-hidden rounded-2xl border border-gray-100 bg-white text-left shadow-2xl shadow-black/10"
      style={{ left: position.left, top: position.bottom + 8, width: position.width, animation: 'dropdownFadeIn 0.18s ease both' }}
    >
      <style>{`@keyframes dropdownFadeIn{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}`}</style>
      <div data-testid="search-dropdown" className="flex max-h-[min(32rem,calc(100dvh-1.5rem))] flex-col overflow-y-auto md:flex-row md:divide-x md:divide-gray-100">
        <div className="min-w-0 w-full md:w-[420px] md:shrink-0">
          <KeywordSuggestions keyword={keyword} onSelect={onSelect} searchBy={searchBy} suggestions={suggestions} />
          <SearchHistorySection isOpen={open} onSearchByChange={onSearchByChange} onSelect={onSelect} searchBy={searchBy} />
        </div>
        <SuggestedJobsSection jobs={jobs} loading={loading} onSelect={selectSuggestedJob} />
      </div>
    </div>,
    document.body,
  )
}
