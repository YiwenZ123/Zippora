import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useEditorStore = defineStore('editor', () => {
  const openTabs = ref<{ fileId: string; fileName: string }[]>([])
  const activeTabId = ref<string | null>(null)

  function openFile(fileId: string, fileName: string) {
    if (!openTabs.value.find(t => t.fileId === fileId)) {
      openTabs.value.push({ fileId, fileName })
    }
    activeTabId.value = fileId
  }

  function closeTab(fileId: string) {
    openTabs.value = openTabs.value.filter(t => t.fileId !== fileId)
    if (activeTabId.value === fileId) {
      activeTabId.value = openTabs.value.length > 0 ? openTabs.value[openTabs.value.length - 1].fileId : null
    }
  }

  function closeAllTabs() {
    openTabs.value = []
    activeTabId.value = null
  }

  return {
    openTabs,
    activeTabId,
    openFile,
    closeTab,
    closeAllTabs
  }
})
