<script setup lang="ts">
import { ref } from 'vue'
import { useProjectStore } from '../../stores/project'
import { useRouter } from 'vue-router'
import type { DashboardViewMode, Project } from '../../types/project'

defineProps<{
  viewMode: DashboardViewMode
}>()

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
  if (hours < 24) return `${hours}小时`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}天前`
  return new Date(timestamp).toLocaleDateString('zh-CN')
}

function handleContextMenu(e: MouseEvent, projectId: string) {
  e.preventDefault()
  contextMenuProject.value = projectId
}

function renameProject(project: Project) {
  const nextName = prompt('重命名项目', project.name)?.trim()
  if (!nextName || nextName === project.name) {
    contextMenuProject.value = null
    return
  }
  store.renameProject(project.id, nextName)
  contextMenuProject.value = null
}

function deleteProject(id: string) {
  const project = store.projects.find(item => item.id === id)
  if (!confirm(`确定删除项目「${project?.name ?? '未命名项目'}」吗？此操作不可恢复。`)) return
  store.deleteProjectById(id)
  contextMenuProject.value = null
}
</script>

<template>
  <section :class="['project-list-container', viewMode]">
    <div v-if="viewMode === 'list'" class="list-header">
      <button class="header-name" type="button">
        名称
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M8 10l4-4 4 4" />
          <path d="M16 14l-4 4-4-4" />
        </svg>
      </button>
      <button class="header-time" type="button">
        创建时间
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
    </div>

    <div v-if="store.filteredProjects.length === 0" class="empty-state">
      <div class="empty-icon">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7z" />
          <path d="M14 2v5h5" />
        </svg>
      </div>
      <p>还没有项目</p>
      <span>点击右上角“新建”创建你的第一个 LaTeX 项目</span>
    </div>

    <div
      v-for="project in store.filteredProjects"
      :key="project.id"
      class="project-row"
      @click="openProject(project.id)"
      @contextmenu="handleContextMenu($event, project.id)"
    >
      <div class="project-main">
        <div class="project-thumb">
          <span class="thumb-line short"></span>
          <span class="thumb-line"></span>
          <span class="thumb-line tiny"></span>
        </div>
        <span class="project-name">{{ project.name }}</span>
      </div>

      <div class="project-time">
        <span>{{ formatTime(project.updatedAt) }}</span>
        <button
          class="more-btn"
          type="button"
          title="更多"
          @click.stop="contextMenuProject = contextMenuProject === project.id ? null : project.id"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="5" cy="12" r="1" />
            <circle cx="12" cy="12" r="1" />
            <circle cx="19" cy="12" r="1" />
          </svg>
        </button>

        <div v-if="contextMenuProject === project.id" class="row-menu" @click.stop>
          <button type="button" @click="openProject(project.id)">打开</button>
          <button type="button" @click="renameProject(project)">重命名</button>
          <button type="button" class="danger" @click="deleteProject(project.id)">删除</button>
        </div>
      </div>
    </div>

    <div v-if="contextMenuProject" class="context-overlay" @click="contextMenuProject = null"></div>
  </section>
</template>

<style scoped>
.project-list-container {
  position: relative;
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 0 20px 28px;
  color: #e6e6e6;
}

.project-list-container.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(178px, 1fr));
  align-content: start;
  gap: 14px;
  padding-top: 16px;
}

.list-header {
  display: grid;
  grid-template-columns: 1fr 132px;
  align-items: center;
  height: 30px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.03);
}

.header-name,
.header-time {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  width: max-content;
  color: #7c7c7c;
  font-size: 11px;
}

.header-name:hover,
.header-time:hover {
  color: #dedede;
}

.header-time {
  justify-self: end;
  margin-right: 32px;
}

.project-row {
  display: grid;
  grid-template-columns: 1fr 132px;
  align-items: center;
  min-height: 48px;
  padding: 0 8px;
  border-radius: 7px;
  cursor: pointer;
}

.project-list-container.grid .project-row {
  grid-template-columns: 1fr;
  align-content: start;
  min-height: 150px;
  padding: 14px;
  border: 1px solid rgba(255, 255, 255, 0.045);
  background: rgba(255, 255, 255, 0.018);
}

.project-list-container.grid .project-main {
  flex-direction: column;
  align-items: flex-start;
  gap: 12px;
}

.project-list-container.grid .project-thumb {
  width: 42px;
  height: 56px;
  padding: 10px 7px;
}

.project-list-container.grid .project-time {
  width: 100%;
  justify-content: space-between;
  margin-top: 12px;
}

.project-list-container.grid .more-btn {
  opacity: 1;
}

.project-row:hover {
  background: rgba(255, 255, 255, 0.045);
}

.project-main {
  display: flex;
  align-items: center;
  gap: 16px;
  min-width: 0;
}

.project-thumb {
  width: 25px;
  height: 32px;
  display: flex;
  flex-shrink: 0;
  flex-direction: column;
  gap: 4px;
  padding: 6px 4px;
  background: #f4f4f4;
  border-radius: 2px;
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.18);
}

.thumb-line {
  height: 2px;
  width: 100%;
  background: #d2d2d2;
  border-radius: 999px;
}

.thumb-line.short {
  width: 60%;
}

.thumb-line.tiny {
  width: 42%;
}

.project-name {
  min-width: 0;
  overflow: hidden;
  color: #ededed;
  font-size: 13px;
  font-weight: 760;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.project-time {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  color: #808080;
  font-size: 12px;
}

.more-btn {
  width: 24px;
  height: 24px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #666;
  border-radius: 50%;
  opacity: 0;
}

.project-row:hover .more-btn,
.more-btn:focus,
.row-menu + .more-btn {
  opacity: 1;
}

.more-btn:hover {
  color: #f2f2f2;
  background: rgba(255, 255, 255, 0.06);
}

.row-menu {
  position: absolute;
  z-index: 25;
  top: 28px;
  right: 0;
  width: 112px;
  padding: 5px;
  border-radius: 8px;
  background: #2c2c2d;
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 16px 42px rgba(0, 0, 0, 0.32);
}

.row-menu button {
  width: 100%;
  height: 28px;
  padding: 0 9px;
  border-radius: 6px;
  color: #dfdfdf;
  text-align: left;
}

.row-menu button:hover {
  background: rgba(255, 255, 255, 0.08);
}

.row-menu .danger {
  color: #ff8f86;
}

.empty-state {
  position: absolute;
  inset: 38px 0 0;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 8px;
  color: #858585;
}

.empty-icon {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #666;
}

.empty-state p {
  color: #dedede;
  font-weight: 700;
}

.empty-state span {
  color: #858585;
  font-size: 12px;
}

.context-overlay {
  position: fixed;
  inset: 0;
  z-index: 10;
}

@media (max-width: 700px) {
  .project-list-container {
    padding-inline: 12px;
  }

  .list-header,
  .project-row {
    grid-template-columns: 1fr;
  }

  .header-time,
  .project-time {
    display: none;
  }
}
</style>
