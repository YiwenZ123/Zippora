export interface VirtualFile {
  id: string
  name: string
  type: 'file' | 'folder'
  parentId: string | null
  content: string
  children?: VirtualFile[]
}

export interface Project {
  id: string
  name: string
  icon: string
  createdAt: number
  updatedAt: number
  files: VirtualFile[]
  mainFile: string
  compileStatus: 'idle' | 'compiling' | 'error' | 'success'
  lastCompileError: string | null
}

export type ProjectFilter = 'all' | 'yours' | 'shared'
