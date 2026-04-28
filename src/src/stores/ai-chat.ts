import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { ChatMessage } from '../types/chat'
import { generateId } from '../utils/id'

export const useAiChatStore = defineStore('ai-chat', () => {
  const messages = ref<ChatMessage[]>([])
  const isStreaming = ref(false)
  const currentProjectId = ref<string | null>(null)

  function setProject(projectId: string) {
    currentProjectId.value = projectId
    messages.value = []
    // Load from localStorage
    try {
      const raw = localStorage.getItem(`latex-editor:chat:${projectId}`)
      if (raw) messages.value = JSON.parse(raw)
    } catch { /* ignore */ }
  }

  function addMessage(role: 'user' | 'assistant', content: string) {
    const msg: ChatMessage = {
      id: generateId(),
      role,
      content,
      timestamp: Date.now()
    }
    messages.value.push(msg)
    persistMessages()
    return msg
  }

  function updateLastAssistant(content: string) {
    const last = messages.value[messages.value.length - 1]
    if (last && last.role === 'assistant') {
      last.content = content
    }
  }

  function clearChat() {
    messages.value = []
    if (currentProjectId.value) {
      localStorage.removeItem(`latex-editor:chat:${currentProjectId.value}`)
    }
  }

  function persistMessages() {
    if (currentProjectId.value) {
      localStorage.setItem(`latex-editor:chat:${currentProjectId.value}`, JSON.stringify(messages.value))
    }
  }

  return {
    messages,
    isStreaming,
    currentProjectId,
    setProject,
    addMessage,
    updateLastAssistant,
    clearChat,
    persistMessages
  }
})
