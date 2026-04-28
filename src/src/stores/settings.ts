import { defineStore } from 'pinia'
import { ref } from 'vue'
import { loadSettings, saveSettings } from '../services/storage'

export const useSettingsStore = defineStore('settings', () => {
  const openaiApiKey = ref('')
  const sidebarVisible = ref(true)
  const aiPanelVisible = ref(false)

  function loadFromStorage() {
    const settings = loadSettings<Record<string, unknown>>()
    if (settings.openaiApiKey) openaiApiKey.value = settings.openaiApiKey as string
  }

  function persist() {
    saveSettings({
      openaiApiKey: openaiApiKey.value
    })
  }

  function setOpenaiApiKey(key: string) {
    openaiApiKey.value = key
    persist()
  }

  return {
    openaiApiKey,
    sidebarVisible,
    aiPanelVisible,
    loadFromStorage,
    setOpenaiApiKey
  }
})
