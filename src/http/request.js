const queryApiBase = new URLSearchParams(window.location.search).get('apiBase')

export const API_BASE_URL = (
  queryApiBase ||
  import.meta.env.VITE_API_BASE_URL ||
  'http://127.0.0.1:3001'
).replace(/\/$/, '')

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

function parseResponseBody(response) {
  if (response.status === 204) return null

  const contentType = response.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    return response.json()
  }

  return response.text()
}

export async function request(path, options = {}) {
  const {
    method = 'GET',
    data,
    body,
    headers = {},
    snapshot,
    ...fetchOptions
  } = options
  const normalizedMethod = String(method).toUpperCase()
  const isMutation = MUTATING_METHODS.has(normalizedMethod)
  const isMediaRequest = path.startsWith('/api/media')
  const isFormData =
    (body !== undefined &&
      typeof FormData !== 'undefined' &&
      body instanceof FormData) ||
    (data !== undefined &&
      typeof FormData !== 'undefined' &&
      data instanceof FormData)
  const requestBody =
    body ??
    (data === undefined
      ? undefined
      : data instanceof FormData
        ? data
        : JSON.stringify(data))
  const requestHeaders = {
    ...(!isFormData && requestBody !== undefined
      ? { 'Content-Type': 'application/json' }
      : {}),
    ...headers,
  }

  if (isMutation && !isMediaRequest) {
    requestHeaders['X-Data-Snapshot'] =
      snapshot === false ? 'skip' : 'required'
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...fetchOptions,
    method: normalizedMethod,
    body: requestBody,
    headers: requestHeaders,
  })

  if (!response.ok) {
    let message = await response.text()
    try {
      const errorBody = JSON.parse(message)
      message = errorBody.error || errorBody.message || message
    } catch {
      // Keep plain-text error responses unchanged.
    }
    throw new Error(message || `请求失败：${response.status}`)
  }

  return parseResponseBody(response)
}

function mutation(method, path, data, options = {}) {
  return request(path, {
    ...options,
    method,
    data,
  })
}

export const http = Object.freeze({
  get(path, options = {}) {
    return request(path, { ...options, method: 'GET' })
  },
  post(path, data, options = {}) {
    return mutation('POST', path, data, options)
  },
  put(path, data, options = {}) {
    return mutation('PUT', path, data, options)
  },
  patch(path, data, options = {}) {
    return mutation('PATCH', path, data, options)
  },
  delete(path, options = {}) {
    return request(path, { ...options, method: 'DELETE' })
  },
})
