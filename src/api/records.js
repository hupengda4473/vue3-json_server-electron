import { http } from '../http/request'

export function listRecords() {
  return http.get('/records')
}

export function createRecord(record, options = {}) {
  return http.post('/records', record, options)
}

export function updateRecord(id, record, options = {}) {
  return http.patch(`/records/${encodeURIComponent(id)}`, record, options)
}

export function deleteRecord(id, options = {}) {
  return http.delete(`/records/${encodeURIComponent(id)}`, options)
}

export function uploadContactImage(file) {
  const formData = new FormData()
  formData.append('image', file)
  return http.post('/api/media', formData)
}

export function deleteContactImage(imagePath, options = {}) {
  const fileName = imagePath.split('/').pop()
  return http.delete(`/api/media/${encodeURIComponent(fileName)}`, options)
}
