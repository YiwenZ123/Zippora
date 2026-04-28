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
  { key: 'article', label: '文章', desc: '简单 LaTeX 文章模板' },
  { key: 'thesis', label: '论文', desc: '带章节结构的学位论文' },
  { key: 'blank', label: '空白', desc: '从最小文档开始' }
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
        <button class="close-btn" @click="emit('close')" title="关闭">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <div class="modal-body">
        <label class="form-label" for="project-name">项目名称</label>
        <input
          id="project-name"
          v-model="projectName"
          type="text"
          placeholder="输入项目名称..."
          autofocus
          @keyup.enter="create"
        />

        <div class="template-section">
          <span class="form-label">模板</span>
          <div class="template-grid">
            <button
              v-for="t in templateOptions"
              :key="t.key"
              :class="['template-card', { selected: selectedTemplate === t.key }]"
              @click="selectedTemplate = t.key"
            >
              <span class="template-icon">
                <svg v-if="t.key === 'article'" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7">
                  <path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7z" />
                  <path d="M14 2v5h5" />
                </svg>
                <svg v-else-if="t.key === 'thesis'" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7">
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                </svg>
                <svg v-else width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7">
                  <rect x="4" y="4" width="16" height="16" rx="2" />
                </svg>
              </span>
              <span class="template-name">{{ t.label }}</span>
              <span class="template-desc">{{ t.desc }}</span>
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
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: rgba(0, 0, 0, 0.52);
  backdrop-filter: blur(12px);
}

.modal {
  width: 480px;
  max-width: 100%;
  max-height: 84vh;
  overflow: auto;
  border-radius: 12px;
  background: #202022;
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 24px 70px rgba(0, 0, 0, 0.48);
  color: #efefef;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 54px;
  padding: 0 18px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.055);
}

.modal-header h2 {
  margin: 0;
  font-size: 16px;
}

.close-btn {
  width: 30px;
  height: 30px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  color: #999;
}

.close-btn:hover {
  color: #fff;
  background: rgba(255, 255, 255, 0.07);
}

.modal-body {
  padding: 18px;
}

.form-label {
  display: block;
  margin-bottom: 8px;
  color: #a2a2a2;
  font-size: 12px;
  font-weight: 700;
}

input {
  width: 100%;
  height: 38px;
  padding: 0 12px;
  border-radius: 8px;
  color: #efefef;
  background: #151516;
  border: 1px solid rgba(255, 255, 255, 0.08);
}

input:focus {
  border-color: rgba(255, 255, 255, 0.22);
  box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.06);
}

.template-section {
  margin-top: 18px;
}

.template-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 9px;
}

.template-card {
  display: flex;
  min-width: 0;
  min-height: 122px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 7px;
  padding: 14px 8px;
  border-radius: 9px;
  color: #cfcfcf;
  background: #28282a;
  border: 1px solid rgba(255, 255, 255, 0.06);
  text-align: center;
}

.template-card:hover {
  background: #303032;
  border-color: rgba(255, 255, 255, 0.14);
}

.template-card.selected {
  color: #fff;
  background: #343434;
  border-color: rgba(255, 255, 255, 0.28);
}

.template-icon {
  color: #b7b7b7;
}

.template-name {
  font-weight: 760;
}

.template-desc {
  color: #8f8f8f;
  font-size: 11px;
  line-height: 1.35;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 14px 18px 18px;
  border-top: 1px solid rgba(255, 255, 255, 0.055);
}

.btn-cancel,
.btn-create {
  height: 34px;
  padding: 0 16px;
  border-radius: 999px;
  font-weight: 700;
}

.btn-cancel {
  color: #d7d7d7;
  background: #303032;
}

.btn-cancel:hover {
  background: #3a3a3c;
}

.btn-create {
  background: #f7f7f7;
  color: #151515;
}

.btn-create:hover {
  background: #fff;
}

@media (max-width: 560px) {
  .template-grid {
    grid-template-columns: 1fr;
  }
}
</style>
