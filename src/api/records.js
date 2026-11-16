import { API_BASE_URL, apiRequest as request } from './client'

export { API_BASE_URL }

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

export function uploadContactImage(file) {
  const formData = new FormData()
  formData.append('image', file)

  return request('/api/media', {
    method: 'POST',
    body: formData,
  })
}

export function deleteContactImage(imagePath) {
  const fileName = imagePath.split('/').pop()
  return request(`/api/media/${encodeURIComponent(fileName)}`, {
    method: 'DELETE',
  })
}

export function getMediaUrl(imagePath) {
  if (!imagePath) return ''
  return `${API_BASE_URL}/${imagePath.replace(/^\/+/, '')}`
}

