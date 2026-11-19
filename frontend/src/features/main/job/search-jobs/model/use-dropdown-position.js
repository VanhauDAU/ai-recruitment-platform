import { useEffect, useState } from 'react'

export default function useDropdownPosition({ anchorRef, isOpen }) {
  const [position, setPosition] = useState(null)

  useEffect(() => {
    if (!isOpen) return undefined

    const updatePosition = () => {
      if (anchorRef?.current) setPosition(anchorRef.current.getBoundingClientRect())
    }

    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [anchorRef, isOpen])

  return position
}
