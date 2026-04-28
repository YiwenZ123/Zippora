<script setup lang="ts">
import { ref, nextTick, watch, computed } from 'vue'
import type { Project } from '../../types/project'
import { useAiChatStore } from '../../stores/ai-chat'
import { useSettingsStore } from '../../stores/settings'

const props = defineProps<{ project: Project }>()
const aiChatStore = useAiChatStore()
const settingsStore = useSettingsStore()

const inputMessage = ref('')
const messagesContainer = ref<HTMLDivElement | null>(null)

const systemPrompt = computed(() => {
  const activeFile = 'main.tex'
  return `你是一个专业的 LaTeX 助手。帮助用户编写、调试和优化 LaTeX 文档。
当前项目: ${props.project.name}
当前编辑的文件可能包含 LaTeX 代码。请用中文回答，除非用户用其他语言提问。`
})

async function sendMessage() {
  const msg = inputMessage.value.trim()
  if (!msg || aiChatStore.isStreaming) return

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
        apiKey: settingsStore.openaiApiKey
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

function scrollToBottom() {
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
  }
}

watch(() => aiChatStore.messages.length, () => {
  nextTick(scrollToBottom)
})
</script>

<template>
  <div class="ai-chat-panel">
    <div class="chat-header">
      <span class="chat-title">AI 助手</span>
      <button class="icon-btn" @click="aiChatStore.clearChat()" title="清空对话">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="3 6 5 6 21 6"/>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
        </svg>
      </button>
    </div>

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
  width: 340px;
  background: var(--bg-sidebar);
  border-left: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}

.chat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border-bottom: 1px solid var(--border);
}

.chat-title {
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--text-secondary);
}

.icon-btn {
  padding: 4px;
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  display: flex;
}

.icon-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
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
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: 600;
  flex-shrink: 0;
}

.chat-message.user .message-avatar {
  background: var(--accent);
  color: white;
}

.chat-message.assistant .message-avatar {
  background: var(--success);
  color: #1E1E1E;
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
  background: var(--accent);
  color: white;
  padding: 8px 12px;
  border-radius: 12px 12px 2px 12px;
}

.chat-message.assistant .message-text {
  background: var(--bg-tertiary);
  padding: 8px 12px;
  border-radius: 12px 12px 12px 2px;
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
  padding: 8px 12px;
  border-top: 1px solid var(--border);
}

.chat-input-area textarea {
  flex: 1;
  resize: none;
  min-height: 36px;
  max-height: 100px;
  padding: 8px 10px;
  font-size: 13px;
  line-height: 1.4;
}

.send-btn {
  width: 36px;
  height: 36px;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--accent);
  color: white;
  flex-shrink: 0;
}

.send-btn:hover:not(:disabled) {
  background: var(--accent-hover);
}

.send-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
</style>
