import { http } from '../http/request'

export function listDrafts() {
  return http.get('/drafts')
}

export function createDraftWithSnapshot(draft) {
  return http.post('/drafts', draft, {
    snapshot: true,
  })
}

export function createDraftWithoutSnapshot(draft) {
  return http.post('/drafts', draft, {
    snapshot: false,
  })
}
