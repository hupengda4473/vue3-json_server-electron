const queryApiBase = new URLSearchParams(window.location.search).get('apiBase')

export const API_BASE_URL = (
  queryApiBase ||
  import.meta.env.VITE_API_BASE_URL ||
  'http://127.0.0.1:3001'
).replace(/\/$/, '')

export async function apiRequest(path, options = {}) {
  const { headers = {}, ...fetchOptions } = options
  const isFormData =
    typeof FormData !== 'undefined' && options.body instanceof FormData

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...fetchOptions,
    headers: {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...headers,
    },
  })

  if (!response.ok) {
    let message = await response.text()
    try {
      const errorBody = JSON.parse(message)
      message = errorBody.error || errorBody.message || message
    } catch {
      // Keep the original response text when it is not JSON.
    }
    throw new Error(message || `请求失败：${response.status}`)
  }

  if (response.status === 204) {
    return null
  }

  return response.json()
}
