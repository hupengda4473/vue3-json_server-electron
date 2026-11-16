import { apiRequest } from './client'

export function listProjects() {
  return apiRequest('/projects')
}

export function createProject(project) {
  return apiRequest('/projects', {
    method: 'POST',
    body: JSON.stringify(project),
  })
}

export function updateProject(id, project) {
  return apiRequest(`/projects/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(project),
  })
}

export function deleteProject(id) {
  return apiRequest(`/projects/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
}
