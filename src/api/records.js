const queryApiBase = new URLSearchParams(window.location.search).get('apiBase')

export const API_BASE_URL = (
  queryApiBase ||
  import.meta.env.VITE_API_BASE_URL ||
  'http://127.0.0.1:3001'
).replace(/\/$/, '')

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  })

  if (!response.ok) {
    const message = await response.text()
    throw new Error(message || `请求失败：${response.status}`)
  }

  if (response.status === 204) {
    return null
  }

  return response.json()
}

export function listRecords() {
  return request('/records')
}

export function createRecord(record) {
  return request('/records', {
    method: 'POST',
    body: JSON.stringify(record),
  })
}

export function updateRecord(id, record) {
  return request(`/records/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(record),
  })
}

export function deleteRecord(id) {
  return request(`/records/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
}
