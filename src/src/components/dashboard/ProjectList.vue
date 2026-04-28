<script setup lang="ts">
import { useProjectStore } from '../../stores/project'
import { useRouter } from 'vue-router'
import { ref } from 'vue'

const store = useProjectStore()
const router = useRouter()
const contextMenuProject = ref<string | null>(null)

function openProject(id: string) {
  router.push({ name: 'editor', params: { id } })
}

function formatTime(timestamp: number): string {
  const diff = Date.now() - timestamp
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes}分钟前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}小时前`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}天前`
  return new Date(timestamp).toLocaleDateString('zh-CN')
}

function handleContextMenu(e: MouseEvent, projectId: string) {
  e.preventDefault()
  contextMenuProject.value = projectId
}

function deleteProject(id: string) {
  store.deleteProjectById(id)
  contextMenuProject.value = null
}
</script>

<template>
  <div class="project-list-container">
    <div class="list-header">
      <span class="col-name">名称</span>
      <span class="col-time">创建时间</span>
      <span class="col-actions"></span>
    </div>

    <div v-if="store.filteredProjects.length === 0" class="empty-state">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
      </svg>
      <p>还没有项目</p>
      <p class="hint">点击"新建"创建你的第一个 LaTeX 项目</p>
    </div>

    <div
      v-for="project in store.filteredProjects"
      :key="project.id"
      class="project-row"
      @click="openProject(project.id)"
      @contextmenu="handleContextMenu($event, project.id)"
    >
      <div class="col-name">
        <div class="project-icon">{{ project.icon }}</div>
        <span class="project-name">{{ project.name }}</span>
      </div>
      <div class="col-time">
        <span class="time-text">{{ formatTime(project.updatedAt) }}</span>
      </div>
      <div class="col-actions">
        <button
          v-if="contextMenuProject === project.id"
          class="action-btn delete"
          @click.stop="deleteProject(project.id)"
        >
          删除
        </button>
        <button class="action-btn more" @click.stop="contextMenuProject = contextMenuProject === project.id ? null : project.id">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="5" r="1"/>
            <circle cx="12" cy="12" r="1"/>
            <circle cx="12" cy="19" r="1"/>
          </svg>
        </button>
      </div>
    </div>

    <div v-if="contextMenuProject" class="context-overlay" @click="contextMenuProject = null"></div>
  </div>
</template>

<style scoped>
.project-list-container {
  flex: 1;
  overflow-y: auto;
  padding: 0;
}

.list-header {
  display: flex;
  align-items: center;
  padding: 8px 24px;
  border-bottom: 1px solid var(--border);
  font-size: 12px;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.col-name {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 10px;
}

.col-time {
  width: 150px;
  text-align: left;
}

.col-actions {
  width: 60px;
  text-align: right;
}

.project-row {
  display: flex;
  align-items: center;
  padding: 10px 24px;
  border-bottom: 1px solid var(--border);
  cursor: pointer;
  transition: background 0.15s;
}

.project-row:hover {
  background: var(--bg-hover);
}

.project-icon {
  width: 36px;
  height: 36px;
  border-radius: var(--radius-sm);
  background: var(--bg-tertiary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 14px;
  color: var(--accent);
  flex-shrink: 0;
}

.project-name {
  font-weight: 500;
  color: var(--text-primary);
}

.time-text {
  font-size: 12px;
  color: var(--text-secondary);
}

.action-btn {
  padding: 4px 8px;
  border-radius: var(--radius-sm);
  font-size: 12px;
}

.more {
  color: var(--text-secondary);
  opacity: 0;
  transition: opacity 0.15s;
}

.project-row:hover .more {
  opacity: 1;
}

.more:hover {
  background: var(--bg-active);
}

.delete {
  color: var(--error);
}

.delete:hover {
  background: rgba(244, 71, 71, 0.1);
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 20px;
  color: var(--text-secondary);
  gap: 8px;
}

.empty-state svg {
  opacity: 0.3;
  margin-bottom: 8px;
}

.empty-state p {
  font-size: 14px;
}

.hint {
  font-size: 12px;
  color: var(--text-muted);
}

.context-overlay {
  position: fixed;
  inset: 0;
  z-index: 100;
}
</style>
