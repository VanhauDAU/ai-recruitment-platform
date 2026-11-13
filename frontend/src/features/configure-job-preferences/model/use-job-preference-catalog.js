import { useEffect, useMemo, useState } from 'react'
import { getJobCategories, getSkills } from '@/entities/job'
import { getProvinces } from '@/entities/location'
import { message } from '@/shared/lib/toast'

/** Danh mục ngành nghề + tỉnh/thành cho mọi bề mặt khai báo nhu cầu công việc. */
export function useJobPreferenceCatalog({ includeSkills = false } = {}) {
  const [loading, setLoading] = useState(true)
  const [categories, setCategories] = useState([])
  const [provinces, setProvinces] = useState([])
  const [skills, setSkills] = useState([])

  useEffect(() => {
    let active = true
    Promise.all([getJobCategories(), getProvinces(), includeSkills ? getSkills() : Promise.resolve([])])
      .then(([categoryData, provinceData, skillData]) => {
        if (!active) return
        setCategories(categoryData)
        setProvinces(provinceData)
        setSkills(skillData)
      })
      .catch(() => {
        if (active) message.error('Không tải được danh mục. Vui lòng thử lại.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [includeSkills])

  const provinceOptions = useMemo(
    () => provinces.map((province) => ({ value: province.id, label: province.name })),
    [provinces],
  )
  const specializationSuggestions = useMemo(
    () => categories
      .filter((category) => category.category_type === 'specialization')
      .map((category) => ({ id: category.id, label: category.name, value: category.name })),
    [categories],
  )
  const skillOptions = useMemo(
    () => skills.map((skill) => ({ value: skill.id, label: skill.name })),
    [skills],
  )

  return { categories, loading, provinceOptions, provinces, skillOptions, skills, specializationSuggestions }
}
