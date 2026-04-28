<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, markRaw } from 'vue'

const props = defineProps<{
  pdfData: ArrayBuffer | null
  error: string | null
  isCompiling: boolean
}>()

const emit = defineEmits<{
  compile: []
}>()

const containerRef = ref<HTMLDivElement | null>(null)
const scale = ref(1.2)
const totalPages = ref(0)
const pdfDoc = ref<any>(null)
const renderError = ref<string | null>(null)

let pdfjsLib: any = null
let pdfjsReady = false
let pendingData: ArrayBuffer | null = null

async function loadPdfjs() {
  try {
    pdfjsLib = await import('pdfjs-dist')
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url
    ).toString()
    pdfjsReady = true
    // Process any pending data that arrived before we finished loading
    if (pendingData) {
      const data = pendingData
      pendingData = null
      await renderPdf(data)
    }
  } catch (e) {
    console.error('Failed to load pdfjs:', e)
    renderError.value = 'PDF 渲染器加载失败: ' + String(e)
  }
}

async function renderPdf(data: ArrayBuffer) {
  if (!pdfjsReady || !containerRef.value) {
    pendingData = data
    return
  }

  renderError.value = null

  try {
    if (pdfDoc.value) {
      pdfDoc.value.destroy()
      pdfDoc.value = null
    }

    const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(data) })
    pdfDoc.value = markRaw(await loadingTask.promise)
    totalPages.value = pdfDoc.value.numPages

    await renderAllPages()
  } catch (e) {
    console.error('PDF render error:', e)
    renderError.value = 'PDF 渲染失败: ' + String(e)
  }
}

async function renderAllPages() {
  if (!pdfDoc.value || !containerRef.value) return

  const container = containerRef.value
  container.innerHTML = ''

  for (let i = 1; i <= totalPages.value; i++) {
    const page = await pdfDoc.value.getPage(i)
    const viewport = page.getViewport({ scale: scale.value })

    const canvas = document.createElement('canvas')
    canvas.width = viewport.width
    canvas.height = viewport.height
    canvas.style.display = 'block'
    canvas.style.margin = '0 auto 12px auto'
    canvas.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)'
    canvas.style.background = 'white'

    const ctx = canvas.getContext('2d')
    if (ctx) {
      await page.render({ canvasContext: ctx, viewport }).promise
    }

    container.appendChild(canvas)
  }
}

// Watch for new PDF data
watch(() => props.pdfData, (newData) => {
  if (newData) {
    renderPdf(newData)
  }
})

// Watch for scale changes
watch(scale, () => {
  if (pdfDoc.value) {
    renderAllPages()
  }
})

onMounted(() => {
  loadPdfjs()
})

onUnmounted(() => {
  if (pdfDoc.value) {
    pdfDoc.value.destroy()
  }
})
</script>

<template>
  <div class="pdf-preview">
    <div class="pdf-toolbar">
      <span class="pdf-title">PDF 预览</span>
      <div class="pdf-controls">
        <button class="compile-btn" @click="emit('compile')" :disabled="isCompiling" title="编译 LaTeX">
          <svg v-if="!isCompiling" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 12a9 9 0 0 1-9 9"/>
            <path d="M3 12a9 9 0 0 1 9-9"/>
            <path d="M21 3v6h-6"/>
            <path d="M3 21v-6h6"/>
          </svg>
          <span v-else class="mini-spinner"></span>
          <span>{{ isCompiling ? '编译中' : '编译' }}</span>
        </button>
        <button @click="scale = Math.max(0.5, scale - 0.2)" title="缩小">-</button>
        <span class="zoom-level">{{ Math.round(scale * 100) }}%</span>
        <button @click="scale = Math.min(3, scale + 0.2)" title="放大">+</button>
      </div>
    </div>

    <div class="pdf-content">
      <!-- Compiling state (no data yet) -->
      <div v-if="isCompiling && !pdfData" class="pdf-state">
        <div class="spinner"></div>
        <span>编译中...</span>
      </div>

      <!-- Error state -->
      <div v-else-if="error || renderError" class="pdf-state error-state">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <line x1="15" y1="9" x2="9" y2="15"/>
          <line x1="9" y1="9" x2="15" y2="15"/>
        </svg>
        <p>编译错误</p>
        <pre class="error-text">{{ error || renderError }}</pre>
      </div>

      <!-- Empty state -->
      <div v-else-if="!pdfData" class="pdf-state">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
        </svg>
        <p>按 Ctrl+S 编译并预览 PDF</p>
      </div>

      <!-- PDF pages (always in DOM for ref) -->
      <div
        ref="containerRef"
        class="pdf-pages"
        :style="{ display: pdfData && !error && !renderError ? 'block' : 'none' }"
      ></div>
    </div>
  </div>
</template>

<style scoped>
.pdf-preview {
  width: 45%;
  background: var(--bg-secondary);
  border-left: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}

.pdf-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 12px;
  height: 36px;
  background: var(--bg-tertiary);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.pdf-title {
  font-size: 12px;
  color: var(--text-secondary);
}

.pdf-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.pdf-controls button {
  width: 24px;
  height: 24px;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  color: var(--text-secondary);
}

.pdf-controls button:hover {
  background: var(--bg-hover);
}

.pdf-controls button:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.pdf-controls .compile-btn {
  width: auto;
  min-width: 64px;
  gap: 6px;
  padding: 0 8px;
  border: 1px solid var(--border);
  font-size: 12px;
  color: var(--text-primary);
}

.mini-spinner {
  width: 12px;
  height: 12px;
  border: 2px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.zoom-level {
  font-size: 11px;
  color: var(--text-secondary);
  min-width: 36px;
  text-align: center;
}

.pdf-content {
  flex: 1;
  overflow: auto;
  background: #525659;
  padding: 16px;
}

.pdf-pages {
  max-width: 100%;
}

.pdf-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 12px;
  color: var(--text-secondary);
}

.error-state {
  color: var(--error);
}

.spinner {
  width: 24px;
  height: 24px;
  border: 2px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.error-text {
  font-family: var(--font-mono);
  font-size: 11px;
  background: var(--bg-primary);
  padding: 12px;
  border-radius: var(--radius-sm);
  max-width: 100%;
  max-height: 200px;
  overflow: auto;
  white-space: pre-wrap;
  color: var(--text-primary);
}
</style>
