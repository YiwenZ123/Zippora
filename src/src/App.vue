<script setup lang="ts">
import { onMounted } from 'vue'
import { useProjectStore } from './stores/project'
import { useSettingsStore } from './stores/settings'

const projectStore = useProjectStore()
const settingsStore = useSettingsStore()

onMounted(() => {
  projectStore.loadFromStorage()
  settingsStore.loadFromStorage()
})
</script>

<template>
  <router-view />
</template>
