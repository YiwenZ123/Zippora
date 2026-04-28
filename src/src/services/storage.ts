import type { Project } from '../types/project'

const PROJECT_PREFIX = 'latex-editor:project:'
const INDEX_KEY = 'latex-editor:project-index'
const SETTINGS_KEY = 'latex-editor:settings'

export function loadProjectIndex(): { id: string; name: string; updatedAt: number }[] {
  try {
    const raw = localStorage.getItem(INDEX_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function saveProjectIndex(index: { id: string; name: string; updatedAt: number }[]) {
  localStorage.setItem(INDEX_KEY, JSON.stringify(index))
}

export function loadProject(id: string): Project | null {
  try {
    const raw = localStorage.getItem(PROJECT_PREFIX + id)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function saveProject(project: Project) {
  localStorage.setItem(PROJECT_PREFIX + project.id, JSON.stringify(project))
  const index = loadProjectIndex()
  const existing = index.findIndex(i => i.id === project.id)
  const entry = { id: project.id, name: project.name, updatedAt: project.updatedAt }
  if (existing >= 0) {
    index[existing] = entry
  } else {
    index.push(entry)
  }
  saveProjectIndex(index)
}

export function deleteProject(id: string) {
  localStorage.removeItem(PROJECT_PREFIX + id)
  const index = loadProjectIndex().filter(i => i.id !== id)
  saveProjectIndex(index)
}

export function loadSettings<T = Record<string, unknown>>(): T {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    return raw ? JSON.parse(raw) : {} as T
  } catch {
    return {} as T
  }
}

export function saveSettings(settings: Record<string, unknown>) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
}
