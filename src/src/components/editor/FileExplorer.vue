<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Project, VirtualFile } from '../../types/project'
import { useProjectStore } from '../../stores/project'
import { useEditorStore } from '../../stores/editor'

const props = defineProps<{ project: Project }>()
const projectStore = useProjectStore()
const editorStore = useEditorStore()

const expandedFolders = ref<Set<string>>(new Set())
const contextMenu = ref<{ fileId: string; x: number; y: number } | null>(null)

interface OutlineItem {
  title: string
  line: number
  level: number
  command: string
}

const outlineSourceFile = computed(() => {
  if (editorStore.activeTabId) {
    const activeFile = projectStore.findFile(props.project.files, editorStore.activeTabId)
    if (activeFile?.type === 'file' && activeFile.name.toLowerCase().endsWith('.tex')) {
      return activeFile
    }
  }
  return findFileByPath(props.project.files, props.project.mainFile)
    ?? findFirstTexFile(props.project.files)
})

const outlineItems = computed(() => {
  if (!outlineSourceFile.value) return []

  const items: OutlineItem[] = []
  const levelByCommand: Record<string, number> = {
    part: 0,
    chapter: 1,
    section: 2,
    subsection: 3,
    subsubsection: 4
  }

  outlineSourceFile.value.content.split('\n').forEach((line, index) => {
    const match = line.match(/\\(part|chapter|section|subsection|subsubsection)\*?(?:\[[^\]]*])?\{([^{}]+)\}/)
    if (!match) return
    items.push({
      command: match[1],
      title: match[2].trim(),
      line: index + 1,
      level: levelByCommand[match[1]] ?? 0
    })
  })

  return items
})

function toggleFolder(fileId: string) {
  if (expandedFolders.value.has(fileId)) {
    expandedFolders.value.delete(fileId)
  } else {
    expandedFolders.value.add(fileId)
  }
}

function openFile(file: VirtualFile) {
  if (file.type === 'file') {
    editorStore.openFile(file.id, file.name)
  } else {
    toggleFolder(file.id)
  }
}

function handleContextMenu(e: MouseEvent, file: VirtualFile) {
  e.preventDefault()
  e.stopPropagation()
  contextMenu.value = { fileId: file.id, x: e.clientX, y: e.clientY }
}

function closeContextMenu() {
  contextMenu.value = null
}

function addNewFile(parentId: string | null, type: 'file' | 'folder') {
  const name = type === 'file' ? 'untitled.tex' : 'new_folder'
  projectStore.addFile(props.project, parentId, name, type)
  closeContextMenu()
}

function deleteFile(fileId: string) {
  projectStore.deleteFile(props.project, fileId)
  closeContextMenu()
}

function openOutlineItem(item: OutlineItem) {
  if (!outlineSourceFile.value) return
  editorStore.openFile(outlineSourceFile.value.id, outlineSourceFile.value.name, item.line)
}

function findFileByPath(files: VirtualFile[], targetPath: string, prefix = ''): VirtualFile | null {
  for (const file of files) {
    const path = prefix ? `${prefix}/${file.name}` : file.name
    if (file.type === 'file' && path === targetPath) return file
    if (file.children) {
      const found = findFileByPath(file.children, targetPath, path)
      if (found) return found
    }
  }
  return null
}

function findFirstTexFile(files: VirtualFile[]): VirtualFile | null {
  for (const file of files) {
    if (file.type === 'file' && file.name.toLowerCase().endsWith('.tex')) return file
    if (file.children) {
      const found = findFirstTexFile(file.children)
      if (found) return found
    }
  }
  return null
}
</script>

<template>
  <div class="file-explorer" @click="closeContextMenu">
    <div class="explorer-header">
      <span class="explorer-title">文件</span>
      <div class="explorer-actions">
        <button class="icon-btn" @click="addNewFile(null, 'file')" title="新建文件">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
        </button>
        <button class="icon-btn" @click="addNewFile(null, 'folder')" title="新建文件夹">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
          </svg>
        </button>
      </div>
    </div>

    <div class="file-tree">
      <template v-for="file in project.files" :key="file.id">
        <div
          :class="['tree-item', { active: editorStore.activeTabId === file.id }]"
          :style="{ paddingLeft: '12px' }"
          @click="openFile(file)"
          @contextmenu="handleContextMenu($event, file)"
        >
          <svg v-if="file.type === 'folder'" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0">
            <path v-if="expandedFolders.has(file.id)" d="M6 9l6 6 6-6"/>
            <path v-else d="M9 18l6-6-6-6"/>
          </svg>
          <svg v-if="file.type === 'file'" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0;color:var(--accent)">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
          </svg>
          <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0;color:var(--warning)">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
          </svg>
          <span class="file-name">{{ file.name }}</span>
        </div>

        <template v-if="file.type === 'folder' && expandedFolders.has(file.id) && file.children">
          <div
            v-for="child in file.children"
            :key="child.id"
            :class="['tree-item', { active: editorStore.activeTabId === child.id }]"
            :style="{ paddingLeft: '28px' }"
            @click="openFile(child)"
            @contextmenu="handleContextMenu($event, child)"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0;color:var(--accent)">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
            <span class="file-name">{{ child.name }}</span>
          </div>
        </template>
      </template>
    </div>

    <div class="outline-panel">
      <div class="outline-header">
        <span>大纲</span>
        <span v-if="outlineSourceFile" class="outline-source">{{ outlineSourceFile.name }}</span>
      </div>
      <div v-if="outlineItems.length > 0" class="outline-list">
        <button
          v-for="item in outlineItems"
          :key="`${item.line}-${item.title}`"
          class="outline-item"
          :style="{ paddingLeft: `${12 + item.level * 10}px` }"
          :title="`${item.command} · 第 ${item.line} 行`"
          @click.stop="openOutlineItem(item)"
        >
          <span class="outline-title">{{ item.title }}</span>
          <span class="outline-line">{{ item.line }}</span>
        </button>
      </div>
      <div v-else class="outline-empty">暂无章节</div>
    </div>

    <!-- Context menu -->
    <div
      v-if="contextMenu"
      class="context-menu"
      :style="{ left: contextMenu.x + 'px', top: contextMenu.y + 'px' }"
    >
      <button @click="addNewFile(contextMenu!.fileId, 'file')">新建文件</button>
      <button @click="addNewFile(contextMenu!.fileId, 'folder')">新建文件夹</button>
      <button class="danger" @click="deleteFile(contextMenu!.fileId)">删除</button>
    </div>
  </div>
</template>

<style scoped>
.file-explorer {
  background: var(--bg-sidebar);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  flex-shrink: 0;
}

.explorer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border-bottom: 1px solid var(--border);
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--text-secondary);
}

.explorer-actions {
  display: flex;
  gap: 2px;
}

.icon-btn {
  padding: 4px;
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  display: flex;
}

.icon-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.file-tree {
  flex: 1 1 55%;
  min-height: 120px;
  overflow-y: auto;
  padding: 4px 0;
}

.tree-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  cursor: pointer;
  user-select: none;
  white-space: nowrap;
  font-size: 13px;
}

.tree-item:hover {
  background: var(--bg-hover);
}

.tree-item.active {
  background: var(--bg-active);
}

.file-name {
  overflow: hidden;
  text-overflow: ellipsis;
}

.context-menu {
  position: fixed;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 4px;
  z-index: 1000;
  min-width: 140px;
}

.context-menu button {
  display: block;
  width: 100%;
  text-align: left;
  padding: 6px 12px;
  border-radius: var(--radius-sm);
  font-size: 12px;
}

.context-menu button:hover {
  background: var(--bg-hover);
}

.context-menu button.danger {
  color: var(--error);
}

.context-menu button.danger:hover {
  background: rgba(244, 71, 71, 0.1);
}

.outline-panel {
  flex: 1 1 45%;
  min-height: 140px;
  border-top: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.outline-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 12px;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--text-secondary);
  border-bottom: 1px solid var(--border);
}

.outline-source {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-transform: none;
  letter-spacing: 0;
  color: var(--text-muted);
}

.outline-list {
  overflow-y: auto;
  padding: 4px 0;
}

.outline-item {
  width: 100%;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding-right: 10px;
  color: var(--text-secondary);
  font-size: 12px;
  text-align: left;
}

.outline-item:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.outline-title {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.outline-line {
  flex-shrink: 0;
  color: var(--text-muted);
  font-size: 11px;
}

.outline-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
  font-size: 12px;
}
</style>
