<script setup lang="ts">
import { ref } from 'vue'
import { useProjectStore } from '../../stores/project'

const emit = defineEmits<{
  newProject: []
}>()

const store = useProjectStore()
const fileInput = ref<HTMLInputElement | null>(null)

function openFilePicker() {
  fileInput.value?.click()
}
</script>

<template>
  <div class="toolbar">
    <h1 class="toolbar-title">{{ store.activeFilter === 'all' ? '所有项目' : store.activeFilter === 'yours' ? '你的项目' : '与你共享' }}</h1>

    <div class="toolbar-actions">
      <div class="search-box">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"/>
          <line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input
          v-model="store.searchQuery"
          type="text"
          placeholder="搜索"
          class="search-input"
        />
      </div>

      <div class="view-toggle">
        <button class="toggle-btn active" title="列表视图">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="8" y1="6" x2="21" y2="6"/>
            <line x1="8" y1="12" x2="21" y2="12"/>
            <line x1="8" y1="18" x2="21" y2="18"/>
            <line x1="3" y1="6" x2="3.01" y2="6"/>
            <line x1="3" y1="12" x2="3.01" y2="12"/>
            <line x1="3" y1="18" x2="3.01" y2="18"/>
          </svg>
        </button>
      </div>

      <button class="toolbar-btn" @click="openFilePicker">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="17 8 12 3 7 8"/>
          <line x1="12" y1="3" x2="12" y2="15"/>
        </svg>
        导入
        <input ref="fileInput" type="file" accept=".tex,.zip" style="display:none" @change="(e: Event) => {}" />
      </button>

      <button class="toolbar-btn primary" @click="emit('newProject')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="12" y1="5" x2="12" y2="19"/>
          <line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        新建
      </button>
    </div>
  </div>
</template>

<style scoped>
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 24px;
  border-bottom: 1px solid var(--border);
  min-height: 52px;
}

.toolbar-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.toolbar-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.search-box {
  display: flex;
  align-items: center;
  gap: 6px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 4px 10px;
}

.search-box svg {
  color: var(--text-secondary);
  flex-shrink: 0;
}

.search-input {
  border: none;
  background: transparent;
  padding: 2px 0;
  width: 160px;
  font-size: 13px;
}

.search-input:focus {
  border: none;
  outline: none;
}

.view-toggle {
  display: flex;
  gap: 2px;
}

.toggle-btn {
  padding: 6px;
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
}

.toggle-btn:hover {
  background: var(--bg-hover);
}

.toggle-btn.active {
  background: var(--bg-active);
  color: var(--text-primary);
}

.toolbar-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  color: var(--text-primary);
  font-size: 13px;
  transition: all 0.15s;
}

.toolbar-btn:hover {
  background: var(--bg-hover);
}

.toolbar-btn.primary {
  background: white;
  color: #000;
  border-color: white;
}

.toolbar-btn.primary:hover {
  background: #e0e0e0;
}
</style>
