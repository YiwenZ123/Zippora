<script setup lang="ts">
import { ref, nextTick, watch, computed } from 'vue'
import type { Project } from '../../types/project'
import { useAiChatStore } from '../../stores/ai-chat'
import { useSettingsStore } from '../../stores/settings'

const props = defineProps<{ project: Project }>()
const aiChatStore = useAiChatStore()
const settingsStore = useSettingsStore()

const inputMessage = ref('')
const apiKeyDraft = ref(settingsStore.openaiApiKey)
const apiBaseUrlDraft = ref(settingsStore.aiApiBaseUrl)
const modelDraft = ref(settingsStore.aiModel)
const showSettings = ref(!settingsStore.openaiApiKey)
const messagesContainer = ref<HTMLDivElement | null>(null)

const isAiConfigured = computed(() =>
  settingsStore.openaiApiKey.trim().length > 0 &&
  settingsStore.aiApiBaseUrl.trim().length > 0 &&
  settingsStore.aiModel.trim().length > 0
)

const systemPrompt = computed(() => {
  const activeFile = 'main.tex'
  return `你是一个专业的 LaTeX 助手。帮助用户编写、调试和优化 LaTeX 文档。
当前项目: ${props.project.name}
当前编辑的文件可能包含 LaTeX 代码。请用中文回答，除非用户用其他语言提问。`
})

async function sendMessage() {
  const msg = inputMessage.value.trim()
  if (!msg || aiChatStore.isStreaming) return

  if (!isAiConfigured.value) {
    showSettings.value = true
    aiChatStore.addMessage('assistant', '请先配置 AI 接口。')
    await nextTick()
    scrollToBottom()
    return
  }

  inputMessage.value = ''
  aiChatStore.addMessage('user', msg)
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
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim()
          if (data === '[DONE]') continue
          try {
            const parsed = JSON.parse(data)
            const content = parsed.choices?.[0]?.delta?.content
            if (content) {
              fullContent += content
              aiChatStore.updateLastAssistant(fullContent)
            }
          } catch { /* skip invalid JSON */ }
        }
      }
    }

    aiChatStore.persistMessages()
  } catch (e: any) {
    aiChatStore.addMessage('assistant', `连接错误: ${e.message}`)
  }

  aiChatStore.isStreaming = false
  await nextTick()
  scrollToBottom()
}

function saveApiKey() {
  settingsStore.setAiConnection({
    apiKey: apiKeyDraft.value.trim(),
    apiBaseUrl: apiBaseUrlDraft.value.trim(),
    model: modelDraft.value.trim()
  })
  showSettings.value = !isAiConfigured.value
}

function clearApiKey() {
  apiKeyDraft.value = ''
  settingsStore.setAiConnection({
    apiKey: '',
    apiBaseUrl: apiBaseUrlDraft.value.trim(),
    model: modelDraft.value.trim()
  })
  showSettings.value = true
}

function scrollToBottom() {
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
  }
}

watch(() => aiChatStore.messages.length, () => {
  nextTick(scrollToBottom)
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
  <div class="ai-chat-panel">
    <div class="chat-header">
      <div class="chat-title-wrap">
        <span class="chat-title">AI 助手</span>
        <span :class="['key-status', isAiConfigured ? 'ready' : 'missing']">
          {{ isAiConfigured ? '已配置' : '未配置' }}
        </span>
      </div>
      <div class="chat-header-actions">
        <button class="icon-btn" @click="showSettings = !showSettings" title="OpenAI API Key">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 2l-2 2m-7.6 7.6a5.5 5.5 0 1 1-3-3L12 5l4 4-4.6 2.6z"/>
            <path d="M15 5l4 4"/>
          </svg>
        </button>
        <button class="icon-btn" @click="aiChatStore.clearChat()" title="清空对话">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          </svg>
        </button>
      </div>
    </div>

    <form v-if="showSettings || !isAiConfigured" class="api-settings" @submit.prevent="saveApiKey">
      <label for="ai-api-base-url">API Base URL</label>
      <input
        id="ai-api-base-url"
        v-model="apiBaseUrlDraft"
        class="settings-input"
        autocomplete="off"
        placeholder="https://api.openai.com/v1"
      />

      <label for="ai-model">模型</label>
      <input
        id="ai-model"
        v-model="modelDraft"
        class="settings-input"
        autocomplete="off"
        placeholder="gpt-4o-mini"
      />

      <label for="openai-api-key">API Key</label>
      <div class="api-key-row">
        <input
          id="openai-api-key"
          v-model="apiKeyDraft"
          class="settings-input"
          type="password"
          autocomplete="off"
          placeholder="sk-..."
        />
        <button type="submit" class="settings-btn primary">保存</button>
      </div>
      <button v-if="settingsStore.openaiApiKey" type="button" class="settings-btn secondary" @click="clearApiKey">
        清除当前 Key
      </button>
    </form>

    <div class="chat-messages" ref="messagesContainer">
      <div v-if="aiChatStore.messages.length === 0" class="chat-empty">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
        <p>向 AI 助手提问 LaTeX 相关问题</p>
      </div>

      <div
        v-for="msg in aiChatStore.messages"
        :key="msg.id"
        :class="['chat-message', msg.role]"
      >
        <div class="message-avatar">{{ msg.role === 'user' ? 'U' : 'AI' }}</div>
        <div class="message-content">
          <pre v-if="msg.role === 'assistant'" class="message-text">{{ msg.content }}</pre>
          <p v-else class="message-text">{{ msg.content }}</p>
        </div>
      </div>

      <div v-if="aiChatStore.isStreaming" class="typing-indicator">
        <span></span><span></span><span></span>
      </div>
    </div>

    <div class="chat-input-area">
      <textarea
        v-model="inputMessage"
        placeholder="输入问题..."
        rows="1"
        @keydown.enter.exact.prevent="sendMessage"
      ></textarea>
      <button class="send-btn" @click="sendMessage" :disabled="!inputMessage.trim() || aiChatStore.isStreaming">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="22" y1="2" x2="11" y2="13"/>
          <polygon points="22 2 15 22 11 13 2 9 22 2"/>
        </svg>
      </button>
    </div>
  </div>
</template>

<style scoped>
.ai-chat-panel {
  position: absolute;
  z-index: 35;
  right: min(32vw, 420px);
  top: 54px;
  bottom: 78px;
  width: 360px;
  max-width: calc(100vw - 40px);
  background: rgba(24, 24, 24, 0.97);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  box-shadow: 0 22px 64px rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(18px);
  overflow: hidden;
}

.chat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 42px;
  padding: 0 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  background: rgba(31, 31, 31, 0.96);
}

.chat-title {
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  color: var(--text-primary);
}

.chat-title-wrap,
.chat-header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.key-status {
  font-size: 11px;
  padding: 3px 7px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.06);
  font-weight: 700;
}

.key-status.ready {
  color: var(--success);
}

.key-status.missing {
  color: var(--warning);
}

.icon-btn {
  padding: 4px;
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  display: flex;
}

.icon-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  color: var(--text-primary);
}

.api-settings {
  padding: 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: rgba(255, 255, 255, 0.035);
}

.api-settings label {
  font-size: 11px;
  color: var(--text-secondary);
}

.api-key-row {
  display: flex;
  gap: 8px;
}

.settings-input {
  width: 100%;
  min-width: 0;
  height: 32px;
  padding: 6px 8px;
  font-size: 12px;
  background: #101010;
  color: var(--text-primary);
  border-color: var(--border);
}

.api-key-row .settings-input {
  flex: 1;
  min-width: 0;
  font-family: var(--font-mono);
}

.settings-btn {
  height: 32px;
  padding: 0 10px;
  border-radius: var(--radius-sm);
  font-size: 12px;
}

.settings-btn.primary {
  background: #f2f2f2;
  color: #111;
}

.settings-btn.secondary {
  align-self: flex-start;
  height: 26px;
  color: var(--text-secondary);
  border: 1px solid var(--border);
}

.settings-btn:hover {
  background: var(--bg-hover);
}

.settings-btn.primary:hover {
  background: #fff;
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 14px 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.chat-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 8px;
  color: var(--text-muted);
  font-size: 12px;
}

.chat-message {
  display: flex;
  gap: 8px;
}

.chat-message.user {
  flex-direction: row-reverse;
}

.message-avatar {
  width: 26px;
  height: 26px;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: 600;
  flex-shrink: 0;
}

.chat-message.user .message-avatar {
  background: #f2f2f2;
  color: #111;
}

.chat-message.assistant .message-avatar {
  background: #d5f7db;
  color: #15161a;
}

.message-content {
  max-width: 85%;
}

.message-text {
  font-size: 13px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
}

.chat-message.user .message-text {
  background: #f2f2f2;
  color: #111;
  padding: 8px 12px;
  border-radius: var(--radius-lg) var(--radius-lg) 2px var(--radius-lg);
}

.chat-message.assistant .message-text {
  background: #222;
  border: 1px solid rgba(255, 255, 255, 0.06);
  padding: 8px 12px;
  border-radius: var(--radius-lg) var(--radius-lg) var(--radius-lg) 2px;
}

.typing-indicator {
  display: flex;
  gap: 4px;
  padding: 4px 0;
}

.typing-indicator span {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--text-muted);
  animation: typing 1.4s infinite both;
}

.typing-indicator span:nth-child(2) { animation-delay: 0.2s; }
.typing-indicator span:nth-child(3) { animation-delay: 0.4s; }

@keyframes typing {
  0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
  40% { opacity: 1; transform: scale(1); }
}

.chat-input-area {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  padding: 10px 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  background: rgba(31, 31, 31, 0.96);
}

.chat-input-area textarea {
  flex: 1;
  resize: none;
  min-height: 36px;
  max-height: 100px;
  padding: 8px 10px;
  font-size: 13px;
  line-height: 1.4;
  background: #101010;
  color: var(--text-primary);
  border-color: var(--border);
}

.send-btn {
  width: 36px;
  height: 36px;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f2f2f2;
  color: #111;
  flex-shrink: 0;
}

.send-btn:hover:not(:disabled) {
  background: #fff;
}

.send-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

@media (max-width: 1080px) {
  .ai-chat-panel {
    right: 12px;
    left: 12px;
    width: auto;
  }
}
</style>
