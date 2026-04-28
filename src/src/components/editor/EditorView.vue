<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useProjectStore } from '../../stores/project'
import { useEditorStore } from '../../stores/editor'
import { useSettingsStore } from '../../stores/settings'
import { useAiChatStore } from '../../stores/ai-chat'
import type { VirtualFile } from '../../types/project'
import FileExplorer from './FileExplorer.vue'
import CodeEditor from './CodeEditor.vue'
import PdfPreview from './PdfPreview.vue'

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
const showCode = ref(true)
const showToolsMenu = ref(false)
const explorerTab = ref<'files' | 'chat'>('files')
const compileError = ref<string | null>(null)
const pdfData = ref<ArrayBuffer | null>(null)
const isCompiling = ref(false)
const quickPrompt = ref('')
const codeEditorRef = ref<InstanceType<typeof CodeEditor> | null>(null)
const explorerWidth = ref(256)
const pdfWidth = ref(520)
const isResizingPdf = ref(false)

let resizeStartX = 0
let resizeStartWidth = 0

const isAiConfigured = computed(() =>
  settingsStore.openaiApiKey.trim().length > 0 &&
  settingsStore.aiApiBaseUrl.trim().length > 0 &&
  settingsStore.aiModel.trim().length > 0
)

const quickPromptStatus = computed(() => {
  if (aiChatStore.isStreaming) return '正在回答...'
  if (isCompiling.value) return '正在准备中...'
  return '随便问'
})

const systemPrompt = computed(() => `你是一个专业的 LaTeX 助手，帮助用户编写、调试和优化论文项目。当前项目: ${project.value?.name ?? 'Untitled'}`)

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

function togglePdf() {
  showPdf.value = !showPdf.value
}

function toggleCode() {
  showCode.value = !showCode.value
}

function compileProject() {
  codeEditorRef.value?.compileLatex()
}

function activateChatTab() {
  showExplorer.value = true
  explorerTab.value = 'chat'
}

async function submitQuickPrompt() {
  const msg = quickPrompt.value.trim()
  if (!msg || aiChatStore.isStreaming) return

  activateChatTab()
  quickPrompt.value = ''
  aiChatStore.addMessage('user', msg)

  if (!isAiConfigured.value) {
    aiChatStore.addMessage('assistant', '请点击左上角设置按钮配置 API Key、Base URL 和模型后再发送。')
    return
  }

  aiChatStore.isStreaming = true

  try {
    const res = await fetch('/api/ai-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: systemPrompt.value },
          ...aiChatStore.messages.map(m => ({ role: m.role, content: m.content }))
        ],
        apiKey: settingsStore.openaiApiKey,
        apiBaseUrl: settingsStore.aiApiBaseUrl,
        model: settingsStore.aiModel
      })
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: '请求失败' }))
      aiChatStore.addMessage('assistant', `错误: ${err.error || err.message || '请求失败'}`)
      aiChatStore.isStreaming = false
      return
    }

    const reader = res.body?.getReader()
    if (!reader) {
      aiChatStore.addMessage('assistant', '无法读取响应')
      aiChatStore.isStreaming = false
      return
    }

    aiChatStore.addMessage('assistant', '')
    let fullContent = ''
    const decoder = new TextDecoder()

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const chunk = decoder.decode(value, { stream: true })
      const lines = chunk.split('\n')
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const data = line.slice(6).trim()
        if (data === '[DONE]') continue
        try {
          const parsed = JSON.parse(data)
          const content = parsed.choices?.[0]?.delta?.content
          if (content) {
            fullContent += content
            aiChatStore.updateLastAssistant(fullContent)
          }
        } catch {
          // Streaming chunks can split JSON boundaries; ignore partial fragments.
        }
      }
    }

    aiChatStore.persistMessages()
  } catch (e: any) {
    aiChatStore.addMessage('assistant', `连接错误: ${e.message}`)
  }

  aiChatStore.isStreaming = false
}

function closeToolsMenu() {
  showToolsMenu.value = false
}

function toggleToolsMenu() {
  showToolsMenu.value = !showToolsMenu.value
}

function clampPdfWidth(value: number) {
  const maxWidth = Math.max(380, window.innerWidth - (showExplorer.value ? explorerWidth.value : 0) - 420)
  return Math.min(Math.max(value, 360), maxWidth)
}

function beginResizePdf(event: MouseEvent) {
  event.preventDefault()
  resizeStartX = event.clientX
  resizeStartWidth = pdfWidth.value
  isResizingPdf.value = true
  document.body.classList.add('resizing-pdf')
  window.addEventListener('mousemove', resizePdf)
  window.addEventListener('mouseup', stopResizePdf)
}

function resizePdf(event: MouseEvent) {
  if (!isResizingPdf.value) return
  pdfWidth.value = clampPdfWidth(resizeStartWidth + resizeStartX - event.clientX)
}

function stopResizePdf() {
  if (!isResizingPdf.value) return
  isResizingPdf.value = false
  document.body.classList.remove('resizing-pdf')
  localStorage.setItem('latex-editor:pdf-width', String(pdfWidth.value))
  window.removeEventListener('mousemove', resizePdf)
  window.removeEventListener('mouseup', stopResizePdf)
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
  const savedPdfWidth = Number(localStorage.getItem('latex-editor:pdf-width'))
  if (Number.isFinite(savedPdfWidth) && savedPdfWidth > 0) {
    pdfWidth.value = clampPdfWidth(savedPdfWidth)
  }

  if (project.value) {
    const mainFile = findFileByPath(project.value.files, project.value.mainFile)
      ?? project.value.files.find(f => f.name === 'main.tex')
    if (mainFile) {
      editorStore.openFile(mainFile.id, mainFile.name)
    }
    aiChatStore.setProject(project.value.id)
  }

  window.addEventListener('click', closeToolsMenu)

  nextTick(() => {
    window.setTimeout(() => {
      if (project.value) compileProject()
    }, 350)
  })
})

onUnmounted(() => {
  window.removeEventListener('click', closeToolsMenu)
  stopResizePdf()
  editorStore.closeAllTabs()
})

function goBack() {
  router.push({ name: 'dashboard' })
}
</script>

<template>
  <div class="editor-view" v-if="project">
    <FileExplorer
      v-if="showExplorer"
      :project="project"
      :active-tab="explorerTab"
      :style="{ width: explorerWidth + 'px' }"
      @update:active-tab="explorerTab = $event"
    />

    <main class="editor-stage" :class="{ 'without-pdf': !showPdf }">
      <div class="stage-toolbar">
        <button class="ghost-icon" @click="goBack" title="返回项目">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>

        <div class="stage-spacer"></div>

        <div class="tools-wrap" @click.stop>
          <button class="tools-button" :class="{ active: showToolsMenu }" @click="toggleToolsMenu">
            工具
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
          </button>

          <div v-if="showToolsMenu" class="tools-menu">
            <button :class="['tool-row', { enabled: showCode }]" type="button" @click="toggleCode">
              <span class="tool-icon">⌘</span>
              <span>代码</span>
              <span :class="['switch', { on: showCode }]"></span>
            </button>
            <button :class="['tool-row', { enabled: showPdf }]" type="button" @click="togglePdf">
              <span class="tool-icon">▣</span>
              <span>PDF</span>
              <span :class="['switch', { on: showPdf }]"></span>
            </button>
            <button :class="['tool-row', { enabled: showExplorer }]" type="button" @click="toggleExplorer">
              <span class="tool-icon">☰</span>
              <span>侧边栏</span>
              <span :class="['switch', { on: showExplorer }]"></span>
            </button>
          </div>
        </div>
      </div>

      <CodeEditor
        v-if="showCode"
        ref="codeEditorRef"
        :project="project"
        @compile="(data, err) => handleCompileResult(data, err)"
        @compiling="isCompiling = true"
      />

      <div v-else class="code-hidden-state">
        <button type="button" @click="showCode = true">显示代码</button>
      </div>

      <form class="quick-ai" @submit.prevent="submitQuickPrompt">
        <textarea
          v-model="quickPrompt"
          :placeholder="quickPromptStatus"
          rows="1"
          @keydown.enter.exact.prevent="submitQuickPrompt"
        ></textarea>
        <div class="quick-actions">
          <button class="quick-icon" type="button" title="打开聊天" @click="activateChatTab">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="9" cy="12" r="5" />
              <path d="M14 12h7" />
              <path d="M17 9l3 3-3 3" />
            </svg>
          </button>
          <button class="quick-icon" type="button" title="新建提问" @click="quickPrompt = ''">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
          <button class="quick-icon" type="button" title="语音输入">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 3v18" />
              <path d="M8 8v8" />
              <path d="M16 8v8" />
              <path d="M4 11v2" />
              <path d="M20 11v2" />
            </svg>
          </button>
          <button class="send-quick" type="submit" :disabled="!quickPrompt.trim() || aiChatStore.isStreaming" title="发送">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 19V5" />
              <path d="M5 12l7-7 7 7" />
            </svg>
          </button>
        </div>
      </form>
    </main>

    <div
      v-if="showPdf"
      class="pdf-resizer"
      :class="{ active: isResizingPdf }"
      title="拖动调整 PDF 宽度"
      @mousedown="beginResizePdf"
    ></div>

    <PdfPreview
      v-if="showPdf"
      :pdf-data="pdfData"
      :error="compileError"
      :is-compiling="isCompiling"
      :download-name="`${project.name}.pdf`"
      :style="{ width: pdfWidth + 'px' }"
      @compile="compileProject"
    />
  </div>

  <div v-else class="not-found">
    <p>项目未找到</p>
    <button @click="goBack">返回项目列表</button>
  </div>
</template>

<style scoped>
.editor-view {
  position: relative;
  display: flex;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background: #030303;
  color: var(--text-primary);
}

.editor-stage {
  position: relative;
  display: flex;
  flex: 1 1 auto;
  min-width: 0;
  flex-direction: column;
  background: #000;
  border-left: 1px solid rgba(255, 255, 255, 0.03);
}

.editor-stage.without-pdf {
  margin-right: 8px;
}

.stage-toolbar {
  position: absolute;
  z-index: 20;
  top: 10px;
  left: 10px;
  right: 8px;
  display: flex;
  align-items: center;
  pointer-events: none;
}

.stage-toolbar > * {
  pointer-events: auto;
}

.stage-spacer {
  flex: 1;
}

.ghost-icon {
  width: 26px;
  height: 26px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #858585;
  border-radius: 6px;
  background: rgba(12, 12, 12, 0.78);
  border: 1px solid rgba(255, 255, 255, 0.06);
}

.ghost-icon:hover {
  color: #f2f2f2;
  background: rgba(255, 255, 255, 0.08);
}

.tools-wrap {
  position: relative;
}

.tools-button {
  height: 30px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 0 10px;
  border-radius: 7px;
  color: #d9e2ff;
  background: rgba(18, 43, 101, 0.78);
  border: 1px solid rgba(93, 132, 255, 0.24);
  font-size: 12px;
  font-weight: 700;
}

.tools-button:hover,
.tools-button.active {
  color: white;
  background: rgba(27, 61, 142, 0.92);
}

.tools-menu {
  position: absolute;
  top: 38px;
  right: 0;
  width: 166px;
  padding: 8px;
  border-radius: 12px;
  background: rgba(58, 58, 58, 0.96);
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 18px 50px rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(18px);
}

.tool-row {
  width: 100%;
  height: 30px;
  display: grid;
  grid-template-columns: 20px 1fr 32px;
  align-items: center;
  gap: 8px;
  padding: 0 4px 0 8px;
  border-radius: 7px;
  color: rgba(255, 255, 255, 0.62);
  text-align: left;
  font-size: 12px;
}

.tool-row:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
}

.tool-row.enabled {
  color: #fff;
}

.tool-icon {
  color: rgba(255, 255, 255, 0.38);
  font-size: 12px;
}

.switch {
  position: relative;
  width: 27px;
  height: 16px;
  justify-self: end;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.35);
  border: 1px solid rgba(255, 255, 255, 0.12);
}

.switch::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.58);
  transition: transform var(--transition-fast), background var(--transition-fast);
}

.switch.on {
  background: #f5f5f5;
}

.switch.on::after {
  transform: translateX(11px);
  background: #1f1f1f;
}

.pdf-resizer {
  position: relative;
  z-index: 24;
  width: 8px;
  flex: 0 0 8px;
  cursor: col-resize;
  background: transparent;
}

.pdf-resizer::after {
  content: '';
  position: absolute;
  top: 8px;
  bottom: 8px;
  left: 3px;
  width: 2px;
  border-radius: 999px;
  background: transparent;
}

.pdf-resizer:hover::after,
.pdf-resizer.active::after {
  background: rgba(93, 132, 255, 0.82);
}

:global(body.resizing-pdf) {
  cursor: col-resize;
  user-select: none;
}

.quick-ai {
  position: absolute;
  z-index: 18;
  left: 20px;
  right: 20px;
  bottom: 12px;
  min-height: 54px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 12px 9px 16px;
  border-radius: 20px;
  background: rgba(24, 24, 24, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.045);
  box-shadow: 0 18px 54px rgba(0, 0, 0, 0.42);
  backdrop-filter: blur(18px);
}

.quick-ai textarea {
  flex: 1;
  min-width: 0;
  min-height: 26px;
  max-height: 78px;
  padding: 5px 0;
  resize: none;
  border: 0;
  background: transparent;
  color: #d8d8d8;
  box-shadow: none;
  line-height: 1.45;
}

.quick-ai textarea::placeholder {
  color: #8d8d8d;
}

.quick-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.quick-icon,
.send-quick {
  width: 30px;
  height: 30px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  color: #9c9c9c;
}

.quick-icon:hover {
  color: #f4f4f4;
  background: rgba(255, 255, 255, 0.07);
}

.send-quick {
  color: #ededed;
  background: rgba(255, 255, 255, 0.08);
}

.send-quick:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.15);
}

.send-quick:disabled {
  opacity: 0.38;
  cursor: not-allowed;
}

.code-hidden-state {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  background: #000;
  color: #777;
}

.code-hidden-state button {
  height: 34px;
  padding: 0 14px;
  border-radius: 8px;
  background: #242424;
  color: #ededed;
  border: 1px solid rgba(255, 255, 255, 0.08);
  font-size: 12px;
}

.code-hidden-state button:hover {
  background: #303030;
}

.not-found {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100vh;
  gap: 16px;
  background: #0f0f0f;
  color: #a8a8a8;
}

.not-found button {
  height: 34px;
  padding: 0 14px;
  border-radius: 7px;
  background: #252525;
  color: #f2f2f2;
}

@media (max-width: 980px) {
  .editor-view :deep(.pdf-preview),
  .pdf-resizer {
    display: none;
  }

  .editor-view :deep(.file-explorer) {
    width: 224px !important;
  }

  .quick-ai {
    left: 10px;
    right: 10px;
  }
}

@media (max-width: 640px) {
  .editor-view :deep(.file-explorer) {
    width: 196px !important;
  }

  .stage-toolbar {
    left: 8px;
    right: 8px;
  }

  .quick-ai {
    min-height: 48px;
    padding: 7px 8px 7px 12px;
  }

  .quick-icon {
    display: none;
  }
}
</style>
