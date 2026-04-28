<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import type { Project, VirtualFile } from '../../types/project'
import { useProjectStore } from '../../stores/project'
import { useEditorStore } from '../../stores/editor'
import { useAiChatStore } from '../../stores/ai-chat'
import { useSettingsStore } from '../../stores/settings'

const props = defineProps<{
  project: Project
  activeTab: 'files' | 'chat'
}>()

const emit = defineEmits<{
  'update:activeTab': ['files' | 'chat']
}>()

const projectStore = useProjectStore()
const editorStore = useEditorStore()
const aiChatStore = useAiChatStore()
const settingsStore = useSettingsStore()

const activeTabModel = computed({
  get: () => props.activeTab,
  set: (value: 'files' | 'chat') => emit('update:activeTab', value)
})

const expandedFolders = ref<Set<string>>(new Set())
const contextMenu = ref<{ fileId: string; x: number; y: number } | null>(null)
const showSettings = ref(false)
const apiKeyDraft = ref(settingsStore.openaiApiKey)
const apiBaseUrlDraft = ref(settingsStore.aiApiBaseUrl)
const modelDraft = ref(settingsStore.aiModel)
const messagesContainer = ref<HTMLDivElement | null>(null)
const showAuthorSettings = ref(false)
const authorNameDraft = ref(localStorage.getItem('zippora:author-name') || 'Your Name')
const authorTitleDraft = ref(localStorage.getItem('zippora:author-title') || props.project.name)
const authorDateDraft = ref(localStorage.getItem('zippora:author-date') || new Date().getFullYear().toString())

interface OutlineItem {
  title: string
  line: number
  level: number
  command: string
}

const isAiConfigured = computed(() =>
  settingsStore.openaiApiKey.trim().length > 0 &&
  settingsStore.aiApiBaseUrl.trim().length > 0 &&
  settingsStore.aiModel.trim().length > 0
)

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
    chapter: 0,
    section: 1,
    subsection: 2,
    subsubsection: 3
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

function renameFile(file: VirtualFile) {
  const nextName = prompt('重命名', file.name)?.trim()
  if (!nextName || nextName === file.name) {
    closeContextMenu()
    return
  }
  const renamed = projectStore.renameFile(props.project, file.id, nextName)
  if (renamed) {
    editorStore.renameTab(file.id, renamed.name)
  }
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

function saveAiSettings() {
  settingsStore.setAiConnection({
    apiKey: apiKeyDraft.value.trim(),
    apiBaseUrl: apiBaseUrlDraft.value.trim(),
    model: modelDraft.value.trim()
  })
  showSettings.value = false
}

function clearAiSettings() {
  apiKeyDraft.value = ''
  settingsStore.setAiConnection({
    apiKey: '',
    apiBaseUrl: apiBaseUrlDraft.value.trim(),
    model: modelDraft.value.trim()
  })
}

function escapeLatexValue(value: string) {
  return value.replace(/[{}]/g, '')
}

function updateCommand(content: string, command: string, value: string) {
  const escaped = escapeLatexValue(value)
  const commandPattern = new RegExp(`\\\\${command}\\s*\\{[^}]*\\}`)
  if (commandPattern.test(content)) {
    return content.replace(commandPattern, `\\${command}{${escaped}}`)
  }
  return `\\${command}{${escaped}}\n${content}`
}

function updateNewCommand(content: string, command: string, value: string) {
  const escaped = escapeLatexValue(value)
  const commandPattern = new RegExp(`\\\\newcommand\\s*\\{\\\\${command}\\}\\s*\\{[^}]*\\}`)
  if (commandPattern.test(content)) {
    return content.replace(commandPattern, `\\newcommand{\\${command}}{${escaped}}`)
  }
  return content
}

function saveAuthorInfo() {
  const authorName = authorNameDraft.value.trim() || 'Your Name'
  const title = authorTitleDraft.value.trim() || props.project.name
  const date = authorDateDraft.value.trim() || new Date().getFullYear().toString()
  localStorage.setItem('zippora:author-name', authorName)
  localStorage.setItem('zippora:author-title', title)
  localStorage.setItem('zippora:author-date', date)

  const target = findFileByPath(props.project.files, props.project.mainFile) ?? findFirstTexFile(props.project.files)
  if (target) {
    let content = target.content
    content = updateCommand(content, 'author', authorName)
    content = updateCommand(content, 'title', title)
    content = updateCommand(content, 'date', date)
    content = updateNewCommand(content, 'name', authorName)
    content = updateNewCommand(content, 'projecttitle', title)
    content = updateNewCommand(content, 'submissiondate', date)
    target.content = content
    projectStore.updateProject(props.project)
  }

  showAuthorSettings.value = false
}

function scrollMessagesToBottom() {
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
  }
}

function fileIcon(file: VirtualFile) {
  if (file.type === 'folder') return expandedFolders.value.has(file.id) ? 'folder-open' : 'folder'
  if (/\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(file.name)) return 'image'
  if (file.name.toLowerCase().endsWith('.bib')) return 'bib'
  if (file.name.toLowerCase().endsWith('.sty')) return 'style'
  return 'tex'
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

watch(() => aiChatStore.messages.length, () => {
  nextTick(scrollMessagesToBottom)
})

watch(() => props.activeTab, (tab) => {
  if (tab === 'chat') nextTick(scrollMessagesToBottom)
})

watch(() => settingsStore.openaiApiKey, (key) => {
  apiKeyDraft.value = key
})

watch(() => settingsStore.aiApiBaseUrl, (url) => {
  apiBaseUrlDraft.value = url
})

watch(() => settingsStore.aiModel, (model) => {
  modelDraft.value = model
})
</script>

<template>
  <aside class="file-explorer" @click="closeContextMenu">
    <div class="side-top">
      <button class="side-icon" title="API 设置" @click.stop="showSettings = !showSettings">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21a2 2 0 1 1-4 0v-.09A1.7 1.7 0 0 0 8.6 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.6 8.6a1.7 1.7 0 0 0-.34-1.88l-.06-.06A2 2 0 1 1 7.03 3.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V3a2 2 0 1 1 4 0v.09A1.7 1.7 0 0 0 15.4 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9c.24.36.6.62 1 .72.17.04.35.06.53.05H21a2 2 0 1 1 0 4h-.09A1.7 1.7 0 0 0 19.4 15Z" />
        </svg>
      </button>
      <button class="side-icon" title="布局">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <path d="M9 4v16" />
        </svg>
      </button>

      <form v-if="showSettings" class="settings-popover" @submit.prevent="saveAiSettings" @click.stop>
        <div class="settings-header">
          <strong>API 配置</strong>
          <span :class="['settings-status', isAiConfigured ? 'ready' : 'missing']">
            {{ isAiConfigured ? '已配置' : '未配置' }}
          </span>
        </div>

        <label for="ai-api-base-url">API Base URL</label>
        <input id="ai-api-base-url" v-model="apiBaseUrlDraft" autocomplete="off" placeholder="https://api.openai.com/v1" />

        <label for="ai-model">模型</label>
        <input id="ai-model" v-model="modelDraft" autocomplete="off" placeholder="gpt-4o-mini" />

        <label for="openai-api-key">API Key</label>
        <input id="openai-api-key" v-model="apiKeyDraft" type="password" autocomplete="off" placeholder="sk-..." />

        <div class="settings-actions">
          <button v-if="settingsStore.openaiApiKey" class="settings-secondary" type="button" @click="clearAiSettings">清除</button>
          <button class="settings-primary" type="submit">保存</button>
        </div>
      </form>
    </div>

    <button class="project-switcher" type="button" title="切换项目">
      <span>{{ project.name }}</span>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M6 9l6 6 6-6" />
      </svg>
    </button>

    <div class="section-tabs">
      <button :class="{ active: activeTabModel === 'files' }" @click="activeTabModel = 'files'">文件</button>
      <button :class="{ active: activeTabModel === 'chat' }" @click="activeTabModel = 'chat'">聊天</button>
      <span class="tab-fill"></span>
      <button class="section-tool" title="搜索">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8" />
          <path d="M21 21l-4.3-4.3" />
        </svg>
      </button>
      <button class="section-tool" title="新建文件" @click="addNewFile(null, 'file')">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 5v14" />
          <path d="M5 12h14" />
        </svg>
      </button>
    </div>

    <div v-if="activeTabModel === 'files'" class="explorer-body">
      <div class="file-tree">
        <template v-for="file in project.files" :key="file.id">
          <div
            :class="['tree-item', { active: editorStore.activeTabId === file.id }]"
            :style="{ paddingLeft: '12px' }"
            @click="openFile(file)"
            @dblclick.stop="renameFile(file)"
            @contextmenu="handleContextMenu($event, file)"
          >
            <span :class="['file-symbol', fileIcon(file)]">
              <svg v-if="file.type === 'folder'" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H10l2 2h6.5A2.5 2.5 0 0 1 21 9.5v7A2.5 2.5 0 0 1 18.5 19h-13A2.5 2.5 0 0 1 3 16.5v-9Z" />
              </svg>
              <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7z" />
                <path d="M14 2v5h5" />
              </svg>
            </span>
            <span class="file-name">{{ file.name }}</span>
            <button v-if="file.type === 'folder'" class="inline-add" title="添加" @click.stop="addNewFile(file.id, 'file')">+</button>
            <svg v-if="file.type === 'folder'" class="chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path v-if="expandedFolders.has(file.id)" d="M6 9l6 6 6-6" />
              <path v-else d="M9 18l6-6-6-6" />
            </svg>
          </div>

          <template v-if="file.type === 'folder' && expandedFolders.has(file.id) && file.children">
            <div
              v-for="child in file.children"
              :key="child.id"
              :class="['tree-item nested', { active: editorStore.activeTabId === child.id }]"
              :style="{ paddingLeft: '30px' }"
              @click="openFile(child)"
              @dblclick.stop="renameFile(child)"
              @contextmenu="handleContextMenu($event, child)"
            >
              <span :class="['file-symbol', fileIcon(child)]">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7z" />
                  <path d="M14 2v5h5" />
                </svg>
              </span>
              <span class="file-name">{{ child.name }}</span>
            </div>
          </template>
        </template>
      </div>

      <div class="outline-panel">
        <div class="outline-header">
          <span>大纲</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M6 9l6 6 6-6" />
          </svg>
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
          </button>
        </div>
        <div v-else class="outline-empty">暂无章节</div>
      </div>
    </div>

    <div v-else class="chat-panel">
      <div class="chat-header">
        <span>AI 助手</span>
        <button type="button" @click="aiChatStore.clearChat()" title="清空聊天">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
            <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </svg>
        </button>
      </div>

      <div ref="messagesContainer" class="chat-messages">
        <div v-if="aiChatStore.messages.length === 0" class="chat-empty">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          <p>在底部输入框向 AI 助手提问</p>
        </div>

        <div
          v-for="msg in aiChatStore.messages"
          :key="msg.id"
          :class="['chat-message', msg.role]"
        >
          <span class="message-role">{{ msg.role === 'user' ? '你' : 'AI' }}</span>
          <pre class="message-text">{{ msg.content }}</pre>
        </div>

        <div v-if="aiChatStore.isStreaming" class="typing-indicator">
          <span></span><span></span><span></span>
        </div>
      </div>
    </div>

    <div class="author-strip">
      <button class="avatar-btn" type="button" @click.stop="showAuthorSettings = !showAuthorSettings">A</button>
      <button class="author-summary" type="button" @click.stop="showAuthorSettings = !showAuthorSettings">
        <span>作者信息</span>
        <small>{{ authorNameDraft || '未填写' }}</small>
      </button>
      <button class="invite-btn" type="button" @click.stop="saveAuthorInfo">保存</button>

      <form v-if="showAuthorSettings" class="author-popover" @submit.prevent="saveAuthorInfo" @click.stop>
        <strong>作者信息</strong>
        <label for="author-name">作者</label>
        <input id="author-name" v-model="authorNameDraft" autocomplete="off" />
        <label for="author-title">标题</label>
        <input id="author-title" v-model="authorTitleDraft" autocomplete="off" />
        <label for="author-date">日期/年份</label>
        <input id="author-date" v-model="authorDateDraft" autocomplete="off" />
        <button type="submit">写入主文件</button>
      </form>
    </div>

    <div
      v-if="contextMenu"
      class="context-menu"
      :style="{ left: contextMenu.x + 'px', top: contextMenu.y + 'px' }"
    >
      <button @click="addNewFile(contextMenu!.fileId, 'file')">新建文件</button>
      <button @click="addNewFile(contextMenu!.fileId, 'folder')">新建文件夹</button>
      <button @click="renameFile(projectStore.findFile(project.files, contextMenu!.fileId)!)">重命名</button>
      <button class="danger" @click="deleteFile(contextMenu!.fileId)">删除</button>
    </div>
  </aside>
</template>

<style scoped>
.file-explorer {
  position: relative;
  z-index: 6;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  height: 100vh;
  overflow: hidden;
  background: #161616;
  border-right: 1px solid rgba(255, 255, 255, 0.045);
  color: #d6d6d6;
}

.side-top {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 54px;
  padding: 0 16px;
}

.side-icon {
  width: 26px;
  height: 26px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #9a9a9a;
  border-radius: 6px;
}

.side-icon:hover {
  color: #fff;
  background: rgba(255, 255, 255, 0.07);
}

.settings-popover {
  position: absolute;
  top: 42px;
  left: 12px;
  z-index: 20;
  width: 232px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  border-radius: 10px;
  background: rgba(34, 34, 35, 0.98);
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 18px 46px rgba(0, 0, 0, 0.42);
}

.settings-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  color: #f2f2f2;
  font-size: 12px;
}

.settings-status {
  height: 20px;
  display: inline-flex;
  align-items: center;
  padding: 0 7px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.07);
  font-size: 11px;
  color: #e0c46c;
}

.settings-status.ready {
  color: #87d49b;
}

.settings-popover label {
  color: #9a9a9a;
  font-size: 11px;
}

.settings-popover input {
  width: 100%;
  height: 30px;
  padding: 0 8px;
  border-radius: 5px;
  background: #101010;
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: #e6e6e6;
  font-size: 12px;
}

.settings-popover input:focus {
  border-color: rgba(255, 255, 255, 0.2);
  box-shadow: none;
}

.settings-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 2px;
}

.settings-primary,
.settings-secondary {
  height: 28px;
  padding: 0 10px;
  border-radius: 6px;
  font-size: 12px;
}

.settings-primary {
  background: #f1f1f1;
  color: #111;
}

.settings-secondary {
  color: #c8c8c8;
  background: rgba(255, 255, 255, 0.07);
}

.project-switcher {
  display: flex;
  align-items: center;
  gap: 6px;
  width: calc(100% - 28px);
  min-height: 28px;
  margin: 0 14px 10px;
  color: #f1f1f1;
  font-size: 13px;
  font-weight: 700;
  text-align: left;
}

.project-switcher span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.section-tabs {
  display: flex;
  align-items: center;
  gap: 12px;
  height: 36px;
  padding: 0 16px;
  color: #8f8f8f;
  border-bottom: 1px solid rgba(255, 255, 255, 0.045);
}

.section-tabs > button:not(.section-tool) {
  position: relative;
  height: 36px;
  color: #8f8f8f;
  font-size: 12px;
}

.section-tabs > button.active {
  color: #fff;
}

.section-tabs > button.active::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 2px;
  background: #ededed;
}

.tab-fill {
  flex: 1;
}

.section-tool {
  width: 22px;
  height: 22px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #777;
  border-radius: 5px;
}

.section-tool:hover {
  color: #fff;
  background: rgba(255, 255, 255, 0.07);
}

.explorer-body {
  display: flex;
  flex: 1;
  min-height: 0;
  flex-direction: column;
  padding-bottom: 44px;
}

.file-tree {
  flex: 0 0 auto;
  min-height: 168px;
  max-height: 254px;
  overflow-y: auto;
  padding: 8px 10px 12px;
}

.tree-item {
  position: relative;
  display: grid;
  grid-template-columns: 16px 1fr auto auto;
  align-items: center;
  gap: 6px;
  min-height: 28px;
  margin-bottom: 1px;
  padding: 4px 8px;
  border-radius: 5px;
  cursor: pointer;
  user-select: none;
  color: #929292;
  font-size: 12px;
}

.tree-item:hover {
  color: #e6e6e6;
  background: rgba(255, 255, 255, 0.045);
}

.tree-item.active {
  color: #fff;
  background: rgba(255, 255, 255, 0.09);
}

.file-symbol {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #7f7f7f;
}

.file-symbol.folder,
.file-symbol.folder-open {
  color: #9c9c9c;
}

.file-symbol.bib {
  color: #b9a27b;
}

.file-symbol.style {
  color: #8fa6bf;
}

.file-symbol.image {
  color: #9ec7a8;
}

.file-name,
.outline-title {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.inline-add,
.chevron {
  opacity: 0;
  color: #8c8c8c;
}

.tree-item:hover .inline-add,
.tree-item:hover .chevron {
  opacity: 1;
}

.inline-add {
  width: 18px;
  height: 18px;
  border-radius: 4px;
  font-size: 14px;
  line-height: 18px;
}

.inline-add:hover {
  color: #fff;
  background: rgba(255, 255, 255, 0.08);
}

.outline-panel {
  flex: 1 1 auto;
  min-height: 130px;
  border-top: 1px solid rgba(255, 255, 255, 0.045);
  overflow: hidden;
}

.outline-header {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 34px;
  padding: 0 14px;
  color: #f1f1f1;
  font-size: 12px;
  font-weight: 650;
}

.outline-list {
  max-height: 156px;
  overflow-y: auto;
  padding: 0 8px 10px;
}

.outline-item {
  width: 100%;
  height: 22px;
  display: flex;
  align-items: center;
  border-radius: 5px;
  color: #858585;
  font-size: 11px;
  text-align: left;
}

.outline-item:hover {
  color: #fff;
  background: rgba(255, 255, 255, 0.045);
}

.outline-empty,
.chat-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 8px;
  min-height: 120px;
  padding: 16px;
  color: #717171;
  text-align: center;
  font-size: 12px;
}

.chat-panel {
  display: flex;
  flex: 1;
  min-height: 0;
  flex-direction: column;
  padding-bottom: 44px;
}

.chat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 34px;
  padding: 0 14px;
  color: #f1f1f1;
  font-size: 12px;
  font-weight: 700;
  border-bottom: 1px solid rgba(255, 255, 255, 0.045);
}

.chat-header button {
  width: 24px;
  height: 24px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 5px;
  color: #858585;
}

.chat-header button:hover {
  color: #fff;
  background: rgba(255, 255, 255, 0.07);
}

.chat-messages {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px 10px 14px;
}

.chat-message {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.chat-message.user {
  align-items: flex-end;
}

.message-role {
  color: #777;
  font-size: 10px;
  padding: 0 4px;
}

.message-text {
  max-width: 94%;
  padding: 8px 10px;
  border-radius: 9px;
  background: #252525;
  color: #dcdcdc;
  font-family: var(--font-ui);
  font-size: 12px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
}

.chat-message.user .message-text {
  background: #f1f1f1;
  color: #111;
}

.typing-indicator {
  display: inline-flex;
  gap: 4px;
  padding: 4px 2px;
}

.typing-indicator span {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #858585;
  animation: typing 1.3s infinite both;
}

.typing-indicator span:nth-child(2) { animation-delay: 0.18s; }
.typing-indicator span:nth-child(3) { animation-delay: 0.36s; }

@keyframes typing {
  0%, 80%, 100% { opacity: 0.3; transform: scale(0.75); }
  40% { opacity: 1; transform: scale(1); }
}

.author-strip {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  display: grid;
  grid-template-columns: 26px 1fr auto;
  align-items: center;
  gap: 8px;
  height: 40px;
  padding: 0 14px;
  background: #161616;
  border-top: 1px solid rgba(255, 255, 255, 0.045);
}

.avatar-btn {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: #2a2a2a;
  color: #d8d8d8;
  font-size: 11px;
}

.author-summary {
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 1px;
  overflow: hidden;
  text-align: left;
}

.author-summary span {
  color: #f1f1f1;
  font-size: 11px;
  font-weight: 700;
}

.author-summary small {
  min-width: 0;
  overflow: hidden;
  max-width: 100%;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #cfcfcf;
  font-size: 10px;
}

.author-popover {
  position: absolute;
  z-index: 32;
  left: 10px;
  bottom: 46px;
  right: 10px;
  display: flex;
  flex-direction: column;
  gap: 7px;
  padding: 11px;
  border-radius: 10px;
  background: #252525;
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 18px 48px rgba(0, 0, 0, 0.45);
}

.author-popover strong {
  color: #f1f1f1;
  font-size: 12px;
}

.author-popover label {
  color: #9a9a9a;
  font-size: 10px;
}

.author-popover input {
  width: 100%;
  height: 28px;
  padding: 0 8px;
  border-radius: 6px;
  background: #111;
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: #ededed;
  font-size: 12px;
}

.author-popover button {
  height: 28px;
  border-radius: 6px;
  background: #f1f1f1;
  color: #111;
  font-size: 12px;
  font-weight: 700;
}

.invite-btn {
  height: 24px;
  padding: 0 10px;
  border-radius: 999px;
  background: #2b2b2b;
  color: #f2f2f2;
  font-size: 11px;
}

.invite-btn:hover {
  background: #3a3a3a;
}

.context-menu {
  position: fixed;
  z-index: 1000;
  min-width: 140px;
  padding: 5px;
  border-radius: 8px;
  background: rgba(44, 44, 44, 0.98);
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 18px 42px rgba(0, 0, 0, 0.44);
}

.context-menu button {
  display: block;
  width: 100%;
  height: 28px;
  padding: 0 10px;
  border-radius: 6px;
  color: #d7d7d7;
  font-size: 12px;
  text-align: left;
}

.context-menu button:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
}

.context-menu button.danger {
  color: #ff8f86;
}
</style>
