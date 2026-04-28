<script setup lang="ts">
import { onMounted, onUnmounted, ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useProjectStore } from '../../stores/project'
import { useEditorStore } from '../../stores/editor'
import { useSettingsStore } from '../../stores/settings'
import { useAiChatStore } from '../../stores/ai-chat'
import type { VirtualFile } from '../../types/project'
import FileExplorer from './FileExplorer.vue'
import CodeEditor from './CodeEditor.vue'
import PdfPreview from './PdfPreview.vue'
import AiChatPanel from './AiChatPanel.vue'
import StatusBar from './StatusBar.vue'

const route = useRoute()
const router = useRouter()
const projectStore = useProjectStore()
const editorStore = useEditorStore()
const settingsStore = useSettingsStore()
const aiChatStore = useAiChatStore()

const projectId = computed(() => route.params.id as string)
const project = computed(() => projectStore.getProject(projectId.value))

const showExplorer = ref(true)
const showPdf = ref(true)
const compileError = ref<string | null>(null)
const pdfData = ref<ArrayBuffer | null>(null)
const isCompiling = ref(false)
const codeEditorRef = ref<InstanceType<typeof CodeEditor> | null>(null)

// Resizable panels
const explorerWidth = ref(220)
const editorFlex = ref(1)

function handleCompileResult(data: ArrayBuffer | null, error: string | null) {
  if (data) {
    pdfData.value = data
    compileError.value = null
    if (project.value) {
      project.value.compileStatus = 'success'
      project.value.lastCompileError = null
    }
  }
  if (error) {
    compileError.value = error
    if (project.value) {
      project.value.compileStatus = 'error'
      project.value.lastCompileError = error
    }
  }
  isCompiling.value = false
}

function toggleExplorer() {
  showExplorer.value = !showExplorer.value
}

function toggleAi() {
  settingsStore.aiPanelVisible = !settingsStore.aiPanelVisible
}

function compileProject() {
  codeEditorRef.value?.compileLatex()
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

onMounted(() => {
  if (project.value) {
    const mainFile = findFileByPath(project.value.files, project.value.mainFile)
      ?? project.value.files.find(f => f.name === 'main.tex')
    if (mainFile) {
      editorStore.openFile(mainFile.id, mainFile.name)
    }
    aiChatStore.setProject(project.value.id)
  }
})

onUnmounted(() => {
  editorStore.closeAllTabs()
})

function goBack() {
  router.push({ name: 'dashboard' })
}
</script>

<template>
  <div class="editor-view" v-if="project">
    <!-- Top bar -->
    <div class="editor-topbar">
      <div class="topbar-left">
        <button class="icon-btn" @click="goBack" title="返回项目列表">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <span class="project-name">{{ project.name }}</span>
        <span class="version-badge">2.0.0</span>
      </div>
      <div class="topbar-right">
        <button class="icon-btn" @click="toggleExplorer" title="切换文件浏览器">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
          </svg>
        </button>
      </div>
    </div>

    <!-- Main content -->
    <div class="editor-main">
      <FileExplorer
        v-if="showExplorer"
        :project="project"
        :style="{ width: explorerWidth + 'px' }"
      />

      <div class="editor-content">
        <CodeEditor
          ref="codeEditorRef"
          :project="project"
          @compile="(data, err) => handleCompileResult(data, err)"
          @compiling="isCompiling = true"
        />
      </div>

      <PdfPreview
        v-if="showPdf"
        :pdf-data="pdfData"
        :error="compileError"
        :is-compiling="isCompiling"
        @compile="compileProject"
      />

      <AiChatPanel
        v-if="settingsStore.aiPanelVisible"
        :project="project"
      />
    </div>

    <!-- Status bar -->
    <StatusBar
      :is-compiling="isCompiling"
      :compile-error="compileError"
      @toggle-ai="toggleAi"
      @toggle-explorer="toggleExplorer"
    />
  </div>
  <div v-else class="not-found">
    <p>项目未找到</p>
    <button @click="goBack">返回项目列表</button>
  </div>
</template>

<style scoped>
.editor-view {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--bg-primary);
}

.editor-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 12px;
  height: 40px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.topbar-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.project-name {
  font-weight: 500;
  font-size: 13px;
}

.version-badge {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 10px;
  background: var(--accent);
  color: white;
  font-weight: 500;
}

.topbar-right {
  display: flex;
  align-items: center;
  gap: 4px;
}

.icon-btn {
  padding: 6px;
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  display: flex;
  align-items: center;
}

.icon-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.editor-main {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.editor-content {
  flex: 1;
  min-width: 0;
}

.not-found {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100vh;
  gap: 16px;
  color: var(--text-secondary);
}

.not-found button {
  padding: 8px 16px;
  border-radius: var(--radius-sm);
  background: var(--accent);
  color: white;
}
</style>
