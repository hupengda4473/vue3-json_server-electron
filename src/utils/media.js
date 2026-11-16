import { API_BASE_URL } from '../http/request'

export function getMediaUrl(imagePath) {
  if (!imagePath) return ''
  return `${API_BASE_URL}/${imagePath.replace(/^\/+/, '')}`
}
