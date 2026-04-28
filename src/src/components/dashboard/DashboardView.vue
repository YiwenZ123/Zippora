<script setup lang="ts">
import Sidebar from './Sidebar.vue'
import Toolbar from './Toolbar.vue'
import ProjectList from './ProjectList.vue'
import NewProjectModal from './NewProjectModal.vue'
import { ref } from 'vue'
import type { DashboardViewMode } from '../../types/project'

const showNewModal = ref(false)
const viewMode = ref<DashboardViewMode>('list')
</script>

<template>
  <div class="dashboard">
    <Sidebar />
    <main class="dashboard-main">
      <Toolbar v-model:view-mode="viewMode" @new-project="showNewModal = true" />
      <ProjectList :view-mode="viewMode" />
    </main>
    <NewProjectModal v-if="showNewModal" @close="showNewModal = false" />
  </div>
</template>

<style scoped>
.dashboard {
  display: flex;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background: #111;
  color: #f4f4f4;
}

.dashboard-main {
  display: flex;
  flex: 1;
  min-width: 0;
  flex-direction: column;
  margin: 6px 6px 6px 0;
  overflow: hidden;
  background: #1f1f21;
  border: 1px solid rgba(255, 255, 255, 0.035);
  border-radius: 0 10px 10px 10px;
  box-shadow: inset 1px 0 0 rgba(255, 255, 255, 0.015);
}

@media (max-width: 760px) {
  .dashboard {
    flex-direction: column;
  }

  .dashboard-main {
    margin: 0;
    border-radius: 0;
    border-inline: 0;
  }
}
</style>
