import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useEditorStore = defineStore('editor', () => {
  const openTabs = ref<{ fileId: string; fileName: string }[]>([])
  const activeTabId = ref<string | null>(null)
  const activeLine = ref<number | undefined>()

  function openFile(fileId: string, fileName: string, line?: number) {
    if (!openTabs.value.find(t => t.fileId === fileId)) {
      openTabs.value.push({ fileId, fileName })
    }
    activeTabId.value = fileId
    activeLine.value = line
  }

  function renameTab(fileId: string, fileName: string) {
    const tab = openTabs.value.find(t => t.fileId === fileId)
    if (tab) tab.fileName = fileName
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
    activeLine,
    openFile,
    renameTab,
    closeTab,
    closeAllTabs
  }
})
