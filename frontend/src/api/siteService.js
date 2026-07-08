import api from './api'

export async function getLinkGroups(placement) {
  const { data } = await api.get('/site/link-groups/', { params: placement ? { placement } : {} })
  return data
}

export async function getSiteSettings() {
  const { data } = await api.get('/site/settings/')
  return data
}

export async function getBanners(placement) {
  const { data } = await api.get('/site/banners/', { params: placement ? { placement } : {} })
  return data
}
