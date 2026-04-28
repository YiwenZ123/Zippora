import type { VirtualFile } from '../types/project'
import { generateId } from './id'

interface ImportedFile {
  path: string
  content: string
  encoding: 'utf8' | 'base64'
}

export interface ImportedProject {
  name: string
  files: VirtualFile[]
  mainFile: string
  skippedFiles: string[]
}

const textFilePattern = /\.(tex|bib|sty|cls|bst|bbx|cbx|cfg|txt|md)$/i
const binaryFilePattern = /\.(png|jpe?g|pdf|eps|svg|gif|bmp|webp)$/i

export async function readImportedProject(file: File): Promise<ImportedProject> {
  if (file.name.toLowerCase().endsWith('.tex')) {
    const fileName = safeFileName(file.name) || 'main.tex'
    return {
      name: stripExtension(fileName),
      files: buildFileTree([{ path: fileName, content: await file.text(), encoding: 'utf8' }]),
      mainFile: fileName,
      skippedFiles: []
    }
  }

  if (file.name.toLowerCase().endsWith('.zip')) {
    return readZipProject(file)
  }

  throw new Error('请选择 .tex 或 .zip 项目文件。')
}

async function readZipProject(file: File): Promise<ImportedProject> {
  const buffer = await file.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  const view = new DataView(buffer)
  const directoryOffset = findCentralDirectory(view)
  const importedFiles: ImportedFile[] = []
  const skippedFiles: string[] = []

  let offset = directoryOffset
  while (offset < bytes.length && view.getUint32(offset, true) === 0x02014b50) {
    const flags = view.getUint16(offset + 8, true)
    const method = view.getUint16(offset + 10, true)
    const compressedSize = view.getUint32(offset + 20, true)
    const nameLength = view.getUint16(offset + 28, true)
    const extraLength = view.getUint16(offset + 30, true)
    const commentLength = view.getUint16(offset + 32, true)
    const localHeaderOffset = view.getUint32(offset + 42, true)
    const nameBytes = bytes.slice(offset + 46, offset + 46 + nameLength)
    const rawPath = decodePath(nameBytes, flags)
    const path = normalizeImportPath(rawPath)

    offset += 46 + nameLength + extraLength + commentLength

    if (!path || rawPath.endsWith('/')) continue
    const isTextFile = textFilePattern.test(path)
    const isBinaryFile = binaryFilePattern.test(path)
    if (!isTextFile && !isBinaryFile) {
      skippedFiles.push(path)
      continue
    }

    if (view.getUint32(localHeaderOffset, true) !== 0x04034b50) {
      skippedFiles.push(path)
      continue
    }

    const localNameLength = view.getUint16(localHeaderOffset + 26, true)
    const localExtraLength = view.getUint16(localHeaderOffset + 28, true)
    const dataStart = localHeaderOffset + 30 + localNameLength + localExtraLength
    try {
      const compressedData = bytes.slice(dataStart, dataStart + compressedSize)
      const data = await inflateZipEntry(compressedData, method)
      importedFiles.push({
        path,
        content: isTextFile ? new TextDecoder().decode(data) : bytesToBase64(data),
        encoding: isTextFile ? 'utf8' : 'base64'
      })
    } catch {
      skippedFiles.push(path)
    }
  }

  const files = stripCommonRoot(importedFiles)
  const mainFile = pickMainFile(files)
  if (!mainFile) {
    throw new Error('导入的 ZIP 中没有找到可用的 .tex 文件。')
  }

  return {
    name: stripExtension(file.name),
    files: buildFileTree(files),
    mainFile,
    skippedFiles
  }
}

function findCentralDirectory(view: DataView): number {
  const minOffset = Math.max(0, view.byteLength - 65557)
  for (let offset = view.byteLength - 22; offset >= minOffset; offset--) {
    if (view.getUint32(offset, true) === 0x06054b50) {
      return view.getUint32(offset + 16, true)
    }
  }
  throw new Error('无法读取 ZIP 文件目录。')
}

async function inflateZipEntry(data: Uint8Array, method: number): Promise<Uint8Array> {
  if (method === 0) return data
  if (method !== 8) {
    throw new Error('ZIP 中包含当前不支持的压缩方式。')
  }
  if (!globalThis.DecompressionStream) {
    throw new Error('当前浏览器不支持 ZIP 解压。')
  }

  const chunk = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer
  const stream = new Blob([chunk]).stream()
    .pipeThrough(new DecompressionStream('deflate-raw' as CompressionFormat))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

function buildFileTree(files: ImportedFile[]): VirtualFile[] {
  const roots: VirtualFile[] = []
  const folders = new Map<string, VirtualFile>()

  for (const file of files.sort((a, b) => a.path.localeCompare(b.path))) {
    const segments = file.path.split('/').filter(Boolean)
    const name = segments.pop()
    if (!name) continue

    let parentId: string | null = null
    let children = roots
    let folderPath = ''

    for (const segment of segments) {
      folderPath = folderPath ? `${folderPath}/${segment}` : segment
      let folder = folders.get(folderPath)
      if (!folder) {
        folder = {
          id: generateId(),
          name: segment,
          type: 'folder',
        parentId,
        content: '',
        encoding: 'utf8',
        children: []
        }
        folders.set(folderPath, folder)
        children.push(folder)
      }
      parentId = folder.id
      children = folder.children ?? []
    }

    children.push({
      id: generateId(),
      name,
      type: 'file',
      parentId,
      content: file.content,
      encoding: file.encoding
    })
  }

  return roots
}

function stripCommonRoot(files: ImportedFile[]): ImportedFile[] {
  const splitPaths = files.map(file => file.path.split('/'))
  const root = splitPaths[0]?.[0]
  if (!root || !splitPaths.every(parts => parts.length > 1 && parts[0] === root)) {
    return files
  }
  return files.map(file => ({
    ...file,
    path: file.path.split('/').slice(1).join('/')
  }))
}

function pickMainFile(files: ImportedFile[]): string {
  const texFiles = files.map(file => file.path).filter(path => path.toLowerCase().endsWith('.tex'))
  return texFiles.find(path => path.toLowerCase() === 'main.tex')
    ?? texFiles.find(path => path.toLowerCase().endsWith('/main.tex'))
    ?? texFiles[0]
    ?? ''
}

function decodePath(bytes: Uint8Array, flags: number): string {
  const encoding = flags & 0x0800 ? 'utf-8' : 'utf-8'
  return new TextDecoder(encoding).decode(bytes)
}

function normalizeImportPath(path: string): string {
  const normalized = path.replace(/\\/g, '/').replace(/^\/+/, '')
  const segments = normalized.split('/').filter(Boolean)
  if (segments.some(segment => segment === '.' || segment === '..')) return ''
  if (segments.length === 0) return ''
  return segments.join('/')
}

function safeFileName(name: string): string {
  return name.replace(/\\/g, '/').split('/').pop()?.replace(/[^\w.\- ]+/g, '_') ?? ''
}

function stripExtension(name: string): string {
  return name.replace(/\.[^.]+$/, '')
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunkSize = 0x8000
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.slice(i, i + chunkSize)
    binary += String.fromCharCode(...chunk)
  }
  return btoa(binary)
}
