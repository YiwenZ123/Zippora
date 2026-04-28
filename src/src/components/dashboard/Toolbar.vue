<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useProjectStore } from '../../stores/project'
import { readImportedProject } from '../../utils/import-project'
import type { DashboardViewMode } from '../../types/project'

const emit = defineEmits<{
  newProject: []
  'update:viewMode': [mode: DashboardViewMode]
}>()

defineProps<{
  viewMode: DashboardViewMode
}>()

const store = useProjectStore()
const router = useRouter()
const fileInput = ref<HTMLInputElement | null>(null)
const isImporting = ref(false)

function openFilePicker() {
  fileInput.value?.click()
}

async function handleImport(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file || isImporting.value) return

  isImporting.value = true
  try {
    const imported = await readImportedProject(file)
    const project = store.createProjectFromFiles(imported.name, imported.files, imported.mainFile)
    if (imported.skippedFiles.length > 0) {
      alert(`已导入项目。以下非文本文件暂未导入: ${imported.skippedFiles.slice(0, 5).join(', ')}${imported.skippedFiles.length > 5 ? '...' : ''}`)
    }
    await router.push({ name: 'editor', params: { id: project.id } })
  } catch (error: any) {
    alert(error?.message || '导入失败，请检查文件格式。')
  } finally {
    isImporting.value = false
    input.value = ''
  }
}
</script>

<template>
  <header class="toolbar">
    <h1 class="toolbar-title">你的项目</h1>

    <div class="toolbar-actions">
      <label class="search-box" title="搜索项目">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8" />
          <path d="M21 21l-4.3-4.3" />
        </svg>
        <input
          v-model="store.searchQuery"
          type="text"
          placeholder="搜索"
          class="search-input"
        />
      </label>

      <div class="view-switch" aria-label="视图切换">
        <button
          :class="['view-btn', { active: viewMode === 'list' }]"
          type="button"
          title="列表视图"
          @click="emit('update:viewMode', 'list')"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="7" cy="7" r="2" />
            <path d="M13 7h7" />
            <circle cx="7" cy="17" r="2" />
            <path d="M13 17h7" />
          </svg>
        </button>
        <button
          :class="['view-btn', { active: viewMode === 'grid' }]"
          type="button"
          title="网格视图"
          @click="emit('update:viewMode', 'grid')"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="4" y="4" width="6" height="6" rx="1" />
            <rect x="14" y="4" width="6" height="6" rx="1" />
            <rect x="4" y="14" width="6" height="6" rx="1" />
            <rect x="14" y="14" width="6" height="6" rx="1" />
          </svg>
        </button>
      </div>

      <button class="toolbar-btn import-btn" @click="openFilePicker" :disabled="isImporting">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <path d="M17 8l-5-5-5 5" />
          <path d="M12 3v12" />
        </svg>
        <span>{{ isImporting ? '导入中' : '导入' }}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M6 9l6 6 6-6" />
        </svg>
        <input ref="fileInput" type="file" accept=".tex,.zip" style="display:none" @change="handleImport" />
      </button>

      <button class="toolbar-btn create-btn" @click="emit('newProject')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 5v14" />
          <path d="M5 12h14" />
        </svg>
        <span>新建</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
    </div>
  </header>
</template>

<style scoped>
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  min-height: 48px;
  padding: 0 18px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
}

.toolbar-title {
  margin: 0;
  color: #f2f2f2;
  font-size: 15px;
  font-weight: 760;
  white-space: nowrap;
}

.toolbar-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.search-box {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 300px;
  height: 34px;
  padding: 0 12px;
  border-radius: 999px;
  background: #2a2a2b;
  border: 1px solid rgba(255, 255, 255, 0.095);
  color: #8e8e8e;
}

.search-input {
  width: 100%;
  min-width: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: #e8e8e8;
  box-shadow: none;
}

.search-input::placeholder {
  color: #8d8d8d;
}

.search-input:focus {
  border: 0;
  box-shadow: none;
}

.view-switch {
  display: inline-flex;
  align-items: center;
  height: 34px;
  padding: 3px;
  border-radius: 999px;
  background: #2a2a2b;
  border: 1px solid rgba(255, 255, 255, 0.07);
}

.view-btn {
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  color: #8d8d8d;
}

.view-btn:hover,
.view-btn.active {
  color: #ededed;
  background: #444;
}

.toolbar-btn {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  height: 34px;
  padding: 0 12px;
  border-radius: 999px;
  background: #2d2d2e;
  color: #ededed;
  border: 1px solid rgba(255, 255, 255, 0.07);
  font-size: 13px;
  font-weight: 650;
  white-space: nowrap;
}

.toolbar-btn:hover:not(:disabled) {
  background: #3a3a3b;
}

.toolbar-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.create-btn {
  background: #f7f7f7;
  color: #171717;
  border-color: #f7f7f7;
}

.create-btn:hover {
  background: #fff;
}

@media (max-width: 900px) {
  .toolbar {
    align-items: flex-start;
    flex-direction: column;
    padding: 14px;
  }

  .toolbar-actions {
    width: 100%;
    flex-wrap: wrap;
  }

  .search-box {
    flex: 1 1 220px;
    width: auto;
  }
}

@media (max-width: 560px) {
  .toolbar-actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
  }

  .search-box {
    grid-column: 1 / -1;
  }

  .view-switch {
    display: none;
  }

  .toolbar-btn {
    justify-content: center;
  }
}
</style>
