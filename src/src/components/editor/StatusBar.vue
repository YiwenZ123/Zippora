<script setup lang="ts">
import { ref } from 'vue'

defineProps<{
  isCompiling: boolean
  compileError: string | null
}>()

const emit = defineEmits<{
  toggleAi: []
  toggleExplorer: []
}>()

const connected = ref(true)
</script>

<template>
  <div class="status-bar">
    <div class="status-left">
      <button class="status-btn ai-btn" @click="emit('toggleAi')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
        AI
      </button>
      <span v-if="isCompiling" class="status-item compiling">
        <span class="dot spinning"></span> 编译中
      </span>
      <span v-else-if="compileError" class="status-item error">
        <span class="dot error"></span> 编译错误
      </span>
      <span v-else class="status-item saved">
        <span class="dot saved"></span> 自动保存
      </span>
    </div>

    <div class="status-right">
      <span class="status-item">
        <span :class="['dot', connected ? 'connected' : 'disconnected']"></span>
        {{ connected ? '已连接' : '未连接' }}
      </span>
    </div>
  </div>
</template>

<style scoped>
.status-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 12px;
  height: 30px;
  background: #101216;
  border-top: 1px solid var(--border);
  font-size: 11px;
  flex-shrink: 0;
}

.status-left, .status-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.status-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  height: 22px;
  padding: 0 8px;
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  font-size: 11px;
}

.status-btn:hover {
  background: rgba(255, 255, 255, 0.07);
  color: var(--text-primary);
}

.ai-btn {
  color: var(--accent);
}

.status-item {
  display: flex;
  align-items: center;
  gap: 4px;
  color: var(--text-secondary);
  height: 22px;
  padding: 0 8px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.035);
}

.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.dot.saved, .dot.connected {
  background: var(--success);
}

.dot.error, .dot.disconnected {
  background: var(--error);
}

.dot.spinning {
  background: var(--accent);
  animation: pulse 1s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

.status-item.error {
  color: var(--error);
}

.status-item.compiling {
  color: var(--accent);
}
</style>
