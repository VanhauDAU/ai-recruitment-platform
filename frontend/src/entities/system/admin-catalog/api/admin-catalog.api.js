import api from '@/shared/api/client'

const SKILLS = '/admin/skills/'
const GROUPS = '/admin/skills/groups/'

function data(request) {
  return request.then((response) => response.data)
}

export function getAdminSkills(params, { signal } = {}) {
  return data(api.get(SKILLS, { params, signal }))
}

export function getAdminSkillSummary({ signal } = {}) {
  return data(api.get(`${SKILLS}summary/`, { signal }))
}

export function createAdminSkill(payload) {
  return data(api.post(SKILLS, payload))
}

export function updateAdminSkill(id, payload) {
  return data(api.patch(`${SKILLS}${id}/`, payload))
}

export function bulkUpdateAdminSkills(ids, changes) {
  return data(api.post(`${SKILLS}bulk-update/`, { ids, ...changes }))
}

export function getAdminSkillMergePreview(id, target, { signal } = {}) {
  return data(api.get(`${SKILLS}${id}/merge-preview/`, { params: { target }, signal }))
}

export function mergeAdminSkill(id, target) {
  return data(api.post(`${SKILLS}${id}/merge/`, { target }))
}

export function getAdminSkillGroups({ signal } = {}) {
  return data(api.get(GROUPS, { signal }))
}

export function createAdminSkillGroup(payload) {
  return data(api.post(GROUPS, payload))
}

export function updateAdminSkillGroup(id, payload) {
  return data(api.patch(`${GROUPS}${id}/`, payload))
}

const CATEGORIES = '/admin/jobs/categories/'
// Danh mục nhỏ sửa trên một màn: phúc lợi, ngôn ngữ (app jobs), lĩnh vực công ty (app employers).
const LOOKUPS = {
  benefits: '/admin/jobs/benefits/',
  languages: '/admin/jobs/languages/',
  industries: '/admin/industries/',
}

export function getAdminJobCategories({ signal } = {}) {
  return data(api.get(CATEGORIES, { signal }))
}

export function createAdminJobCategory(payload) {
  return data(api.post(CATEGORIES, payload))
}

export function updateAdminJobCategory(id, payload) {
  return data(api.patch(`${CATEGORIES}${id}/`, payload))
}

export function uploadAdminCategoryIcon(file) {
  const form = new FormData()
  form.append('file', file)
  return data(api.post(`${CATEGORIES}icon/`, form))
}

export function getAdminLookup(kind, { signal } = {}) {
  return data(api.get(LOOKUPS[kind], { signal }))
}

export function createAdminLookup(kind, payload) {
  return data(api.post(LOOKUPS[kind], payload))
}

export function updateAdminLookup(kind, id, payload) {
  return data(api.patch(`${LOOKUPS[kind]}${id}/`, payload))
}

export function reorderAdminBenefits(ids) {
  return data(api.post(`${LOOKUPS.benefits}reorder/`, { ids }))
}
