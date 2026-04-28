<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
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
  fontSize: 13,
  lineHeight: 19,
  fontFamily: "Consolas, 'SFMono-Regular', 'Courier New', monospace",
  minimap: { enabled: false },
  lineNumbers: 'on',
  lineNumbersMinChars: 3,
  automaticLayout: true,
  wordWrap: 'on',
  tabSize: 2,
  scrollBeyondLastLine: false,
  overviewRulerBorder: false,
  hideCursorInOverviewRuler: true,
  renderLineHighlight: 'none',
  padding: { top: 18, bottom: 96 },
  scrollbar: {
    verticalScrollbarSize: 8,
    horizontalScrollbarSize: 8
  }
}

const activeFile = computed(() => {
  if (!editorStore.activeTabId) return null
  return projectStore.findFile(props.project.files, editorStore.activeTabId)
})

const editorLine = computed(() => editorStore.activeLine)
const localContent = ref('')

const imageMimeTypes: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  bmp: 'image/bmp',
  svg: 'image/svg+xml'
}

const activeExtension = computed(() => {
  const name = activeFile.value?.name ?? ''
  return name.includes('.') ? name.split('.').pop()?.toLowerCase() ?? '' : ''
})

const isImageFile = computed(() => Boolean(activeFile.value && imageMimeTypes[activeExtension.value]))

const imageSource = computed(() => {
  if (!activeFile.value || !isImageFile.value) return ''
  const mime = imageMimeTypes[activeExtension.value]
  if (activeFile.value.encoding === 'base64') {
    return `data:${mime};base64,${activeFile.value.content}`
  }
  if (mime === 'image/svg+xml') {
    return `data:${mime};charset=utf-8,${encodeURIComponent(activeFile.value.content)}`
  }
  return ''
})

function syncToLocal() {
  if (activeFile.value) {
    localContent.value = activeFile.value.content
  }
}

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
    <div class="editor-tabs" v-if="editorStore.openTabs.length > 0">
      <div class="tab-spacer"></div>
      <button
        v-for="tab in editorStore.openTabs"
        :key="tab.fileId"
        :class="['editor-tab', { active: editorStore.activeTabId === tab.fileId }]"
        @click="editorStore.activeTabId = tab.fileId"
      >
        <span class="tab-file-icon">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7z" />
            <path d="M14 2v5h5" />
          </svg>
        </span>
        <span class="tab-name">{{ tab.fileName }}</span>
        <span class="tab-close" @click.stop="editorStore.closeTab(tab.fileId)">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </span>
      </button>
    </div>

    <div class="editor-wrapper">
      <div class="monaco-placeholder" v-if="!editorStore.activeTabId">
        <span>选择一个文件开始编辑</span>
      </div>

      <div v-else-if="isImageFile" class="image-preview-pane">
        <div class="image-preview-shell">
          <img v-if="imageSource" :src="imageSource" :alt="activeFile?.name" />
          <div v-else class="image-preview-empty">无法预览此图片</div>
        </div>
        <div class="image-preview-meta">
          <strong>{{ activeFile?.name }}</strong>
          <span>{{ activeExtension.toUpperCase() }} · {{ activeFile?.encoding === 'base64' ? '图片文件' : '文本图片' }}</span>
        </div>
      </div>

      <VueMonacoEditor
        v-if="editorStore.activeTabId && !isImageFile"
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
  flex: 1;
  min-height: 0;
  flex-direction: column;
  background: #000;
}

.editor-tabs {
  display: flex;
  align-items: center;
  min-height: 48px;
  padding: 0 78px 0 36px;
  overflow-x: auto;
  background: #000;
  border-bottom: 1px solid rgba(255, 255, 255, 0.035);
}

.tab-spacer {
  width: 6px;
  flex-shrink: 0;
}

.editor-tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 28px;
  max-width: 188px;
  margin-right: 6px;
  padding: 0 9px;
  border-radius: 999px;
  color: #a4a4a4;
  background: transparent;
  border: 1px solid transparent;
  font-size: 12px;
}

.editor-tab:hover {
  color: #f0f0f0;
  background: rgba(255, 255, 255, 0.055);
}

.editor-tab.active {
  color: #f4f4f4;
  background: #242424;
  border-color: rgba(255, 255, 255, 0.12);
}

.tab-file-icon,
.tab-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.tab-file-icon {
  color: #b7b7b7;
}

.tab-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tab-close {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  color: #8d8d8d;
  opacity: 0;
}

.editor-tab:hover .tab-close,
.editor-tab.active .tab-close {
  opacity: 1;
}

.tab-close:hover {
  color: #fff;
  background: rgba(255, 255, 255, 0.12);
}

.editor-wrapper {
  position: relative;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  background: #000;
}

.monaco-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #6f6f6f;
  background: #000;
}

.image-preview-pane {
  display: flex;
  height: 100%;
  min-height: 0;
  flex-direction: column;
  background: #050505;
}

.image-preview-shell {
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 52px 32px 96px;
  overflow: auto;
}

.image-preview-shell img {
  display: block;
  max-width: min(100%, 1100px);
  max-height: 100%;
  object-fit: contain;
  background:
    linear-gradient(45deg, #222 25%, transparent 25%),
    linear-gradient(-45deg, #222 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #222 75%),
    linear-gradient(-45deg, transparent 75%, #222 75%);
  background-color: #171717;
  background-position: 0 0, 0 10px, 10px -10px, -10px 0;
  background-size: 20px 20px;
  border-radius: 6px;
  box-shadow: 0 14px 44px rgba(0, 0, 0, 0.42);
}

.image-preview-empty {
  color: #777;
  font-size: 13px;
}

.image-preview-meta {
  position: absolute;
  left: 28px;
  bottom: 76px;
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 9px 11px;
  border-radius: 8px;
  background: rgba(18, 18, 18, 0.86);
  border: 1px solid rgba(255, 255, 255, 0.06);
  color: #ededed;
}

.image-preview-meta strong {
  font-size: 12px;
}

.image-preview-meta span {
  color: #8e8e8e;
  font-size: 11px;
}

:deep(.monaco-editor),
:deep(.monaco-editor-background),
:deep(.monaco-editor .inputarea.ime-input),
:deep(.monaco-editor .margin),
:deep(.monaco-editor .monaco-scrollable-element) {
  background-color: #000 !important;
}

:deep(.monaco-editor .line-numbers) {
  color: #5f5f5f !important;
  font-size: 12px;
}

:deep(.monaco-editor .current-line),
:deep(.monaco-editor .view-overlays .current-line) {
  border-color: transparent !important;
}

:deep(.monaco-editor .cursor) {
  background-color: #f3f3f3 !important;
}
</style>
