<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { VueMonacoEditor } from '@guolao/vue-monaco-editor'
import type { Project } from '../../types/project'
import { useProjectStore } from '../../stores/project'
import { useEditorStore } from '../../stores/editor'

const props = defineProps<{
  project: Project
}>()

const emit = defineEmits<{
  compile: [data: ArrayBuffer | null, error: string | null]
  compiling: []
}>()

const projectStore = useProjectStore()
const editorStore = useEditorStore()

const saveTimer = ref<ReturnType<typeof setTimeout> | null>(null)
const compileTimer = ref<ReturnType<typeof setTimeout> | null>(null)

const editorOptions = {
  fontSize: 14,
  fontFamily: "Consolas, 'Courier New', monospace",
  minimap: { enabled: false },
  lineNumbers: 'on',
  automaticLayout: true,
  wordWrap: 'on',
  tabSize: 2,
  scrollBeyondLastLine: false,
  padding: { top: 8 },
  renderLineHighlight: 'line'
}

const activeFile = computed(() => {
  if (!editorStore.activeTabId) return null
  return projectStore.findFile(props.project.files, editorStore.activeTabId)
})

const editorLine = computed(() => editorStore.activeLine)

// Local content to avoid computed-setter re-render loop with Monaco
const localContent = ref('')

function syncToLocal() {
  if (activeFile.value) {
    localContent.value = activeFile.value.content
  }
}

// Sync when active file changes
const stopWatch = computed(() => editorStore.activeTabId)

function handleInput(value: string) {
  localContent.value = value
  if (activeFile.value && editorStore.activeTabId) {
    projectStore.updateFileContent(props.project, editorStore.activeTabId, value)
  }
  scheduleAutoSave()
  scheduleAutoCompile()
}

function scheduleAutoSave() {
  if (saveTimer.value) clearTimeout(saveTimer.value)
  saveTimer.value = setTimeout(() => {
    projectStore.updateProject(props.project)
  }, 500)
}

function scheduleAutoCompile() {
  if (compileTimer.value) clearTimeout(compileTimer.value)
  emit('compiling')
  compileTimer.value = setTimeout(() => {
    compileLatex()
  }, 2000)
}

async function compileLatex() {
  emit('compiling')
  const files = projectStore.flattenFiles(props.project.files)
  try {
    const res = await fetch('/api/compile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ files, mainFile: props.project.mainFile })
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: '编译失败' }))
      emit('compile', null, err.error || err.message || '编译失败')
      return
    }
    const data = await res.arrayBuffer()
    emit('compile', data, null)
  } catch (e: any) {
    emit('compile', null, e.message || '无法连接编译服务器')
  }
}

defineExpose({ compileLatex })

function handleSave() {
  projectStore.updateProject(props.project)
  compileLatex()
}

function handleKeydown(e: KeyboardEvent) {
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault()
    handleSave()
  }
}

// Watch active tab changes to sync content
import { watch } from 'vue'
watch(() => editorStore.activeTabId, () => {
  syncToLocal()
}, { immediate: true })

onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
  syncToLocal()
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
  if (saveTimer.value) clearTimeout(saveTimer.value)
  if (compileTimer.value) clearTimeout(compileTimer.value)
})
</script>

<template>
  <div class="code-editor-container">
    <!-- Editor tabs -->
    <div class="editor-tabs" v-if="editorStore.openTabs.length > 0">
      <div
        v-for="tab in editorStore.openTabs"
        :key="tab.fileId"
        :class="['editor-tab', { active: editorStore.activeTabId === tab.fileId }]"
        @click="editorStore.activeTabId = tab.fileId"
      >
        <span class="tab-name">{{ tab.fileName }}</span>
        <button class="tab-close" @click.stop="editorStore.closeTab(tab.fileId)">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
    </div>

    <!-- Monaco editor -->
    <div class="editor-wrapper">
      <div class="monaco-placeholder" v-if="!editorStore.activeTabId">
        <p>选择一个文件开始编辑</p>
      </div>
      <VueMonacoEditor
        v-if="editorStore.activeTabId"
        v-model:value="localContent"
        language="latex"
        theme="vs-dark"
        :path="editorStore.activeTabId"
        :line="editorLine"
        :options="editorOptions"
        @change="handleInput"
        style="height: 100%"
      />
    </div>
  </div>
</template>

<style scoped>
.code-editor-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #1E1E1E;
}

.editor-tabs {
  display: flex;
  background: var(--bg-sidebar);
  border-bottom: 1px solid var(--border);
  overflow-x: auto;
  flex-shrink: 0;
}

.editor-tab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-right: 1px solid var(--border);
  cursor: pointer;
  font-size: 12px;
  color: var(--text-secondary);
  white-space: nowrap;
  transition: background 0.1s;
}

.editor-tab:hover {
  background: var(--bg-hover);
}

.editor-tab.active {
  background: #1E1E1E;
  color: var(--text-primary);
}

.tab-close {
  padding: 2px;
  border-radius: var(--radius-sm);
  color: var(--text-muted);
  display: flex;
  opacity: 0;
  transition: opacity 0.1s;
}

.editor-tab:hover .tab-close,
.editor-tab.active .tab-close {
  opacity: 1;
}

.tab-close:hover {
  background: var(--bg-active);
  color: var(--text-primary);
}

.editor-wrapper {
  flex: 1;
  overflow: hidden;
}

.monaco-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--text-muted);
  font-size: 14px;
}
</style>
