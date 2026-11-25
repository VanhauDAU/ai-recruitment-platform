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
