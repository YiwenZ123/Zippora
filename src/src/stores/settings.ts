import { defineStore } from 'pinia'
import { ref } from 'vue'
import { loadSettings, saveSettings } from '../services/storage'

const DEFAULT_AI_API_BASE_URL = 'https://api.openai.com/v1'
const DEFAULT_AI_MODEL = 'gpt-4o-mini'

export const useSettingsStore = defineStore('settings', () => {
  const openaiApiKey = ref('')
  const aiApiBaseUrl = ref(DEFAULT_AI_API_BASE_URL)
  const aiModel = ref(DEFAULT_AI_MODEL)
  const sidebarVisible = ref(true)
  const aiPanelVisible = ref(false)

  function loadFromStorage() {
    const settings = loadSettings<Record<string, unknown>>()
    if (settings.openaiApiKey) openaiApiKey.value = settings.openaiApiKey as string
    if (settings.aiApiBaseUrl) aiApiBaseUrl.value = settings.aiApiBaseUrl as string
    if (settings.aiModel) aiModel.value = settings.aiModel as string
  }

  function persist() {
    saveSettings({
      openaiApiKey: openaiApiKey.value,
      aiApiBaseUrl: aiApiBaseUrl.value,
      aiModel: aiModel.value
    })
  }

  function setOpenaiApiKey(key: string) {
    openaiApiKey.value = key
    persist()
  }

  function setAiConnection(settings: { apiKey: string; apiBaseUrl: string; model: string }) {
    openaiApiKey.value = settings.apiKey
    aiApiBaseUrl.value = settings.apiBaseUrl || DEFAULT_AI_API_BASE_URL
    aiModel.value = settings.model || DEFAULT_AI_MODEL
    persist()
  }

  return {
    openaiApiKey,
    aiApiBaseUrl,
    aiModel,
    sidebarVisible,
    aiPanelVisible,
    loadFromStorage,
    setOpenaiApiKey,
    setAiConnection
  }
})
