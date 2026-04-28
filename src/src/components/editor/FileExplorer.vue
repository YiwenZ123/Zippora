<script setup lang="ts">
import { ref } from 'vue'
import type { Project, VirtualFile } from '../../types/project'
import { useProjectStore } from '../../stores/project'
import { useEditorStore } from '../../stores/editor'

const props = defineProps<{ project: Project }>()
const projectStore = useProjectStore()
const editorStore = useEditorStore()

const expandedFolders = ref<Set<string>>(new Set())
const contextMenu = ref<{ fileId: string; x: number; y: number } | null>(null)

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
  flex: 1;
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
</style>
