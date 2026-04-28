import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Project, ProjectFilter, VirtualFile } from '../types/project'
import { generateId } from '../utils/id'
import { templates, type TemplateName } from '../utils/latex-templates'
import { loadProjectIndex, loadProject, saveProject, deleteProject as removeProject } from '../services/storage'

export const useProjectStore = defineStore('project', () => {
  const projects = ref<Project[]>([])
  const activeFilter = ref<ProjectFilter>('yours')
  const searchQuery = ref('')

  const filteredProjects = computed(() => {
    let result = projects.value
    if (activeFilter.value === 'yours') {
      // In localStorage mode, all projects are "yours"
    }
    if (searchQuery.value) {
      const q = searchQuery.value.toLowerCase()
      result = result.filter(p => p.name.toLowerCase().includes(q))
    }
    return result.sort((a, b) => b.updatedAt - a.updatedAt)
  })

  function loadFromStorage() {
    const index = loadProjectIndex()
    projects.value = index.map(i => loadProject(i.id)).filter((p): p is Project => p !== null)
  }

  function createProject(name: string, templateName: TemplateName = 'article'): Project {
    const project: Project = {
      id: generateId(),
      name,
      icon: name.charAt(0).toUpperCase(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      files: templates[templateName](),
      mainFile: 'main.tex',
      compileStatus: 'idle',
      lastCompileError: null
    }
    projects.value.push(project)
    saveProject(project)
    return project
  }

  function createProjectFromFiles(name: string, files: VirtualFile[], mainFile: string): Project {
    const project: Project = {
      id: generateId(),
      name,
      icon: name.charAt(0).toUpperCase(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      files,
      mainFile,
      compileStatus: 'idle',
      lastCompileError: null
    }
    projects.value.push(project)
    saveProject(project)
    return project
  }

  function getProject(id: string): Project | undefined {
    return projects.value.find(p => p.id === id)
  }

  function deleteProjectById(id: string) {
    projects.value = projects.value.filter(p => p.id !== id)
    removeProject(id)
  }

  function updateProject(project: Project) {
    project.updatedAt = Date.now()
    saveProject(project)
  }

  function updateFileContent(project: Project, fileId: string, content: string) {
    const file = findFile(project.files, fileId)
    if (file) {
      file.content = content
      file.encoding = 'utf8'
      updateProject(project)
    }
  }

  function findFile(files: VirtualFile[], fileId: string): VirtualFile | null {
    for (const f of files) {
      if (f.id === fileId) return f
      if (f.children) {
        const found = findFile(f.children, fileId)
        if (found) return found
      }
    }
    return null
  }

  function addFile(project: Project, parentId: string | null, name: string, type: 'file' | 'folder') {
    const newFile: VirtualFile = {
      id: generateId(),
      name,
      type,
      parentId,
      content: type === 'file' ? '' : '',
      encoding: 'utf8',
      children: type === 'folder' ? [] : undefined
    }
    if (parentId) {
      const parent = findFile(project.files, parentId)
      if (parent && parent.type === 'folder') {
        if (!parent.children) parent.children = []
        parent.children.push(newFile)
      }
    } else {
      project.files.push(newFile)
    }
    updateProject(project)
    return newFile
  }

  function deleteFile(project: Project, fileId: string) {
    function removeFromList(files: VirtualFile[]): boolean {
      const idx = files.findIndex(f => f.id === fileId)
      if (idx >= 0) {
        files.splice(idx, 1)
        return true
      }
      for (const f of files) {
        if (f.children && removeFromList(f.children)) return true
      }
      return false
    }
    removeFromList(project.files)
    updateProject(project)
  }

  function flattenFiles(files: VirtualFile[], prefix = ''): { path: string; content: string; encoding?: 'utf8' | 'base64' }[] {
    const result: { path: string; content: string; encoding?: 'utf8' | 'base64' }[] = []
    for (const f of files) {
      const path = prefix ? `${prefix}/${f.name}` : f.name
      if (f.type === 'file') {
        result.push({ path, content: f.content, encoding: f.encoding ?? 'utf8' })
      }
      if (f.children) {
        result.push(...flattenFiles(f.children, path))
      }
    }
    return result
  }

  return {
    projects,
    activeFilter,
    searchQuery,
    filteredProjects,
    loadFromStorage,
    createProject,
    createProjectFromFiles,
    getProject,
    deleteProjectById,
    updateProject,
    updateFileContent,
    findFile,
    addFile,
    deleteFile,
    flattenFiles
  }
})
