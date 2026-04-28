<script setup lang="ts">
import Sidebar from './Sidebar.vue'
import Toolbar from './Toolbar.vue'
import ProjectList from './ProjectList.vue'
import NewProjectModal from './NewProjectModal.vue'
import { ref } from 'vue'

const showNewModal = ref(false)
</script>

<template>
  <div class="dashboard">
    <Sidebar />
    <div class="dashboard-main">
      <Toolbar @new-project="showNewModal = true" />
      <ProjectList />
    </div>
    <NewProjectModal v-if="showNewModal" @close="showNewModal = false" />
  </div>
</template>

<style scoped>
.dashboard {
  display: flex;
  height: 100vh;
  background: var(--bg-primary);
}

.dashboard-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
</style>
