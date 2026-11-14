import api from '@/shared/api/client'

// API cổng quản trị Mẫu CV (CVT-4). Thư viện, vị trí, trường riêng, nội dung mẫu
// dùng chung một khuôn CRUD; các thao tác đặc thù là hàm riêng bên dưới.
const BASE = '/v2/admin'
const results = (data) => (Array.isArray(data) ? data : data?.results || [])
const read = async (path, params) => (await api.get(`${BASE}${path}`, { params })).data
const write = async (method, path, body = {}) => (await api[method](`${BASE}${path}`, body)).data

function collection(resource) {
  return {
    list: async (params) => results(await read(`/${resource}/`, params)),
    create: (payload) => write('post', `/${resource}/`, payload),
    update: (id, payload) => write('patch', `/${resource}/${id}/`, payload),
    remove: async (id) => { await api.delete(`${BASE}/${resource}/${id}/`) },
  }
}

export const adminCvTemplates = collection('cv-templates')
export const adminCvCategories = collection('cv-categories')
export const adminCvColors = collection('cv-colors')
export const adminCvPositions = collection('cv-positions')
export const adminCvPositionFields = collection('cv-position-fields')
export const adminCvSamples = collection('cv-sample-contents')
export const adminCvBackgrounds = {
  ...collection('cv-backgrounds'),
  create: (file, title = '') => {
    const body = new FormData()
    body.append('file', file)
    body.append('title', title)
    return write('post', '/cv-backgrounds/', body)
  },
}

export const getAdminCvTemplate = (publicId) => read(`/cv-templates/${publicId}/`)
export const getAdminCvPosition = (publicId) => read(`/cv-positions/${publicId}/`)
export const getAdminCvOverview = () => read('/cv-stats/overview/')

// Trang chỉnh sửa template
export const createAdminTemplateVersion = (templateId, payload = {}) => write('post', `/cv-templates/${templateId}/versions/`, payload)
export const configureAdminTemplateVersion = (templateId, versionId, payload) => write('patch', `/cv-templates/${templateId}/versions/${versionId}/config/`, payload)
export const setAdminTemplateColors = (templateId, colorIds, defaultColorId) => write('put', `/cv-templates/${templateId}/colors/`, { color_public_ids: colorIds, default_color_public_id: defaultColorId })
export const previewAdminTemplate = (templateId, payload) => write('post', `/cv-templates/${templateId}/preview/`, payload)
export const requestAdminTemplateTestPdf = (templateId, versionId, payload) => write('post', `/cv-templates/${templateId}/versions/${versionId}/test-pdf/`, payload)
export const getAdminTemplateTestPdf = (token) => read(`/cv-templates/test-pdf/${token}/`)
export async function downloadAdminTemplateTestPdf(token) {
  const { data } = await api.get(`${BASE}/cv-templates/test-pdf/${token}/`, { params: { download: 1 }, responseType: 'blob' })
  return data
}
export const getAdminTemplateChecklist = (templateId, versionId) => read(`/cv-templates/${templateId}/versions/${versionId}/checklist/`)
export const publishAdminTemplateVersion = (templateId, versionId) => write('post', `/cv-templates/${templateId}/versions/${versionId}/publish/`)
export const duplicateAdminTemplate = (templateId) => write('post', `/cv-templates/${templateId}/duplicate/`)
export const reorderAdminTemplates = (publicIds) => write('post', '/cv-templates/reorder/', { public_ids: publicIds })
export const setAdminTemplateVisibility = (templateId, visible) => write('post', `/cv-templates/${templateId}/lifecycle/`, { status: visible ? 'published' : 'archived' })

// Vị trí và nội dung mẫu
export const getAdminCvCoverage = () => read('/cv-positions/coverage/')
export const exportAdminCvPositions = (positionIds) => read('/cv-positions/export/', positionIds?.length ? { position: positionIds.join(',') } : undefined)
export const importAdminCvPositions = (payload) => write('post', '/cv-positions/import/', payload)
export const publishAdminCvSample = (sampleId) => write('post', `/cv-sample-contents/${sampleId}/publish/`)
export const archiveAdminCvSample = (sampleId) => write('post', `/cv-sample-contents/${sampleId}/archive/`)
export const generateAdminCvSamples = (payload) => write('post', '/cv-sample-contents/generate/', payload)
export const getAdminCvGenerations = async (batchId) => results(await read('/cv-sample-generations/', { batch: batchId }))
export const estimateAdminCvGeneration = (count) => read('/cv-sample-generations/estimate/', { count })

// CV ứng viên (chỉ metadata; nội dung cần lý do và được ghi nhật ký)
export const getAdminUserCvs = (params) => read('/user-cvs/', params)
export const viewAdminUserCvContent = (cvId, reason) => write('post', `/user-cvs/${cvId}/content/`, { reason })
export const lockAdminUserCv = (cvId, reason) => write('post', `/user-cvs/${cvId}/lock/`, { reason })
export const unlockAdminUserCv = (cvId) => write('post', `/user-cvs/${cvId}/unlock/`)
