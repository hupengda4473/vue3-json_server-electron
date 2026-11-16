import { http } from '../http/request'

export function listProjects() {
  return http.get('/projects')
}

export function createProject(project, options = {}) {
  return http.post('/projects', project, options)
}

export function updateProject(id, project, options = {}) {
  return http.patch(`/projects/${encodeURIComponent(id)}`, project, options)
}

export function deleteProject(id, options = {}) {
  return http.delete(`/projects/${encodeURIComponent(id)}`, options)
}
