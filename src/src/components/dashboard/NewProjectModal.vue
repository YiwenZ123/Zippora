<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useProjectStore } from '../../stores/project'
import type { TemplateName } from '../../utils/latex-templates'

const emit = defineEmits<{ close: [] }>()
const router = useRouter()
const store = useProjectStore()

const projectName = ref('')
const selectedTemplate = ref<TemplateName>('article')

const templateOptions: { key: TemplateName; label: string; desc: string }[] = [
  { key: 'article', label: '文章', desc: '简单的文章模板' },
  { key: 'thesis', label: '论文', desc: '学位论文模板，包含章节' },
  { key: 'blank', label: '空白', desc: '从空白文档开始' }
]

function create() {
  const name = projectName.value.trim() || '未命名项目'
  const project = store.createProject(name, selectedTemplate.value)
  emit('close')
  router.push({ name: 'editor', params: { id: project.id } })
}
</script>

<template>
  <div class="modal-overlay" @click.self="emit('close')">
    <div class="modal">
      <div class="modal-header">
        <h2>新建项目</h2>
        <button class="close-btn" @click="emit('close')">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      <div class="modal-body">
        <div class="form-group">
          <label>项目名称</label>
          <input
            v-model="projectName"
            type="text"
            placeholder="输入项目名称..."
            autofocus
            @keyup.enter="create"
          />
        </div>

        <div class="form-group">
          <label>模板</label>
          <div class="template-grid">
            <button
              v-for="t in templateOptions"
              :key="t.key"
              :class="['template-card', { selected: selectedTemplate === t.key }]"
              @click="selectedTemplate = t.key"
            >
              <div class="template-icon">
                <svg v-if="t.key === 'article'" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                </svg>
                <svg v-else-if="t.key === 'thesis'" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
                </svg>
                <svg v-else width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                </svg>
              </div>
              <div class="template-info">
                <span class="template-name">{{ t.label }}</span>
                <span class="template-desc">{{ t.desc }}</span>
              </div>
            </button>
          </div>
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn-cancel" @click="emit('close')">取消</button>
        <button class="btn-create" @click="create">创建</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  width: 480px;
  max-height: 80vh;
  overflow: auto;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border);
}

.modal-header h2 {
  font-size: 16px;
  font-weight: 600;
}

.close-btn {
  color: var(--text-secondary);
  padding: 4px;
  border-radius: var(--radius-sm);
}

.close-btn:hover {
  background: var(--bg-hover);
}

.modal-body {
  padding: 20px;
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 6px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.form-group input {
  width: 100%;
}

.template-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.template-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 16px 8px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--bg-tertiary);
  transition: all 0.15s;
}

.template-card:hover {
  border-color: var(--text-secondary);
}

.template-card.selected {
  border-color: var(--accent);
  background: rgba(0, 122, 204, 0.1);
}

.template-icon {
  color: var(--text-secondary);
}

.template-card.selected .template-icon {
  color: var(--accent);
}

.template-info {
  text-align: center;
}

.template-name {
  display: block;
  font-weight: 500;
  font-size: 13px;
}

.template-desc {
  display: block;
  font-size: 11px;
  color: var(--text-secondary);
  margin-top: 2px;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 16px 20px;
  border-top: 1px solid var(--border);
}

.btn-cancel {
  padding: 8px 16px;
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
}

.btn-cancel:hover {
  background: var(--bg-hover);
}

.btn-create {
  padding: 8px 20px;
  border-radius: var(--radius-sm);
  background: var(--accent);
  color: white;
  font-weight: 500;
}

.btn-create:hover {
  background: var(--accent-hover);
}
</style>
