import api from './api'

export async function fetchAllPages(url, params) {
  let response = await api.get(url, { params })
  const results = [...(response.data.results || response.data)]
  let nextUrl = response.data.next
  while (nextUrl) {
    response = await api.get(nextUrl)
    results.push(...(response.data.results || response.data))
    nextUrl = response.data.next
  }
  return results
}
