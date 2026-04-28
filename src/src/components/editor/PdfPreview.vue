<script setup lang="ts">
import { computed, markRaw, onMounted, onUnmounted, ref, watch } from 'vue'

const props = defineProps<{
  pdfData: ArrayBuffer | null
  error: string | null
  isCompiling: boolean
  downloadName?: string
}>()

const emit = defineEmits<{
  compile: []
}>()

const containerRef = ref<HTMLDivElement | null>(null)
const scale = ref(0.92)
const totalPages = ref(0)
const currentPage = ref(1)
const pdfDoc = ref<any>(null)
const renderError = ref<string | null>(null)
const downloadData = ref<ArrayBuffer | null>(null)

let pdfjsLib: any = null
let pdfjsReady = false
let pendingData: ArrayBuffer | null = null

const pageLabel = computed(() => String(currentPage.value).padStart(2, '0'))
const totalLabel = computed(() => totalPages.value ? totalPages.value : '--')
const canDownload = computed(() => Boolean(downloadData.value?.byteLength))

function getOutputScale() {
  const dpr = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1
  return Math.min(Math.max(dpr, 2), 3)
}

function getDownloadName() {
  const fallback = 'document.pdf'
  const rawName = (props.downloadName || fallback).trim() || fallback
  const safeName = rawName.replace(/[\\/:*?"<>|]+/g, '-')
  return safeName.toLowerCase().endsWith('.pdf') ? safeName : `${safeName}.pdf`
}

function downloadPdf() {
  if (!downloadData.value) return

  const blob = new Blob([downloadData.value.slice(0)], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = getDownloadName()
  link.rel = 'noopener'
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

async function loadPdfjs() {
  try {
    pdfjsLib = await import('pdfjs-dist')
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url
    ).toString()
    pdfjsReady = true
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

    const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(data.slice(0)) })
    pdfDoc.value = markRaw(await loadingTask.promise)
    totalPages.value = pdfDoc.value.numPages
    currentPage.value = Math.min(currentPage.value, totalPages.value || 1)

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
    const outputScale = getOutputScale()

    const pageShell = document.createElement('div')
    pageShell.className = 'pdf-page-shell'
    pageShell.dataset.page = String(i)

    const canvas = document.createElement('canvas')
    canvas.width = Math.floor(viewport.width * outputScale)
    canvas.height = Math.floor(viewport.height * outputScale)
    canvas.style.display = 'block'
    canvas.style.width = 'min(100%, ' + viewport.width + 'px)'
    canvas.style.height = 'auto'
    canvas.style.background = 'white'

    const ctx = canvas.getContext('2d')
    if (ctx) {
      await page.render({
        canvasContext: ctx,
        viewport,
        transform: outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : undefined
      }).promise
    }

    pageShell.appendChild(canvas)
    container.appendChild(pageShell)
  }
}

function fitToPanel() {
  scale.value = 0.92
}

function zoomOut() {
  scale.value = Math.max(0.55, Number((scale.value - 0.12).toFixed(2)))
}

function zoomIn() {
  scale.value = Math.min(1.8, Number((scale.value + 0.12).toFixed(2)))
}

function scrollToPage(pageNumber: number) {
  if (!containerRef.value || !totalPages.value) return
  const nextPage = Math.min(Math.max(pageNumber, 1), totalPages.value)
  currentPage.value = nextPage
  const target = containerRef.value.querySelector<HTMLElement>(`[data-page="${nextPage}"]`)
  target?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function previousPage() {
  scrollToPage(currentPage.value - 1)
}

function nextPage() {
  scrollToPage(currentPage.value + 1)
}

function handleScroll() {
  if (!containerRef.value) return
  const containerTop = containerRef.value.getBoundingClientRect().top
  const pages = Array.from(containerRef.value.querySelectorAll<HTMLElement>('.pdf-page-shell'))
  let nearest = currentPage.value
  let nearestDistance = Number.POSITIVE_INFINITY

  for (const page of pages) {
    const distance = Math.abs(page.getBoundingClientRect().top - containerTop - 18)
    if (distance < nearestDistance) {
      nearestDistance = distance
      nearest = Number(page.dataset.page || 1)
    }
  }

  currentPage.value = nearest
}

watch(() => props.pdfData, (newData) => {
  if (newData) {
    downloadData.value = newData.slice(0)
    renderPdf(newData)
  } else {
    downloadData.value = null
  }
}, { immediate: true })

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
  <aside class="pdf-preview">
    <div class="pdf-toolbar">
      <button class="compile-state" @click="emit('compile')" :disabled="isCompiling" title="编译 LaTeX">
        <span :class="['state-spinner', { active: isCompiling }]"></span>
        <span>{{ isCompiling ? '正在编译...' : '编译' }}</span>
      </button>

      <div class="page-readout">
        <strong>{{ pageLabel }}</strong>
        <span>共 {{ totalLabel }} 页</span>
      </div>

      <div class="pdf-actions">
        <button class="fit-button" type="button" @click="fitToPanel">缩放以适配</button>
        <button type="button" class="round-action" @click="zoomOut" title="缩小">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M5 12h14" />
          </svg>
        </button>
        <button type="button" class="round-action" @click="zoomIn" title="放大">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 5v14" />
            <path d="M5 12h14" />
          </svg>
        </button>
        <button type="button" class="round-action" @click="downloadPdf" :disabled="!canDownload" title="下载 PDF">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <path d="M7 10l5 5 5-5" />
            <path d="M12 15V3" />
          </svg>
        </button>
        <button type="button" class="round-action" title="更多">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="5" cy="12" r="1" />
            <circle cx="12" cy="12" r="1" />
            <circle cx="19" cy="12" r="1" />
          </svg>
        </button>
      </div>
    </div>

    <div class="pdf-content">
      <div v-if="props.isCompiling && !props.pdfData" class="pdf-state">
        <div class="progress-line"><span></span></div>
        <p>正在初始化...</p>
      </div>

      <div v-else-if="props.error || renderError" class="pdf-state error-state">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10" />
          <line x1="15" y1="9" x2="9" y2="15" />
          <line x1="9" y1="9" x2="15" y2="15" />
        </svg>
        <p>编译错误</p>
        <pre class="error-text">{{ props.error || renderError }}</pre>
      </div>

      <div v-else-if="!props.pdfData" class="pdf-state">
        <div class="progress-line muted"><span></span></div>
        <p>正在准备中...</p>
      </div>

      <div
        ref="containerRef"
        class="pdf-pages"
        :style="{ display: props.pdfData && !props.error && !renderError ? 'block' : 'none' }"
        @scroll="handleScroll"
      ></div>

      <div class="floating-pager">
        <button type="button" title="重新编译" @click="emit('compile')">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 12a9 9 0 0 1-9 9" />
            <path d="M3 12a9 9 0 0 1 9-9" />
            <path d="M21 3v6h-6" />
          </svg>
        </button>
        <button type="button" title="适配宽度" @click="fitToPanel">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 12h18" />
            <path d="M8 7l-5 5 5 5" />
            <path d="M16 7l5 5-5 5" />
          </svg>
        </button>
        <button type="button" title="下载 PDF" @click="downloadPdf" :disabled="!canDownload">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <path d="M7 10l5 5 5-5" />
            <path d="M12 15V3" />
          </svg>
        </button>
        <button type="button" title="上一页" @click="previousPage">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <button type="button" title="下一页" @click="nextPage">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
      </div>
    </div>
  </aside>
</template>

<style scoped>
.pdf-preview {
  display: flex;
  flex: 0 0 auto;
  width: 520px;
  min-width: 360px;
  max-width: calc(100vw - 380px);
  height: calc(100vh - 16px);
  margin: 8px 8px 8px 0;
  overflow: hidden;
  flex-direction: column;
  background: #fff;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.75), 0 18px 58px rgba(0, 0, 0, 0.55);
  color: #1d1d1d;
}

.pdf-toolbar {
  display: grid;
  grid-template-columns: minmax(100px, 1fr) auto minmax(132px, 1fr);
  align-items: center;
  gap: 8px;
  height: 45px;
  padding: 0 12px;
  flex-shrink: 0;
  background: #fff;
  border-bottom: 1px solid #ececec;
}

.compile-state {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
  color: #2c2c2c;
  font-size: 12px;
  justify-self: start;
}

.compile-state:disabled {
  cursor: default;
}

.state-spinner {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 1.6px solid #d8d8d8;
  border-top-color: #1c1c1c;
}

.state-spinner.active {
  animation: spin 0.85s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.page-readout {
  display: inline-flex;
  align-items: baseline;
  gap: 12px;
  justify-content: center;
  min-width: 78px;
  color: #676767;
  font-size: 12px;
  white-space: nowrap;
}

.page-readout strong {
  color: #151515;
  font-size: 12px;
  font-weight: 750;
}

.pdf-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
  min-width: 0;
}

.fit-button {
  height: 28px;
  padding: 0 8px;
  color: #454545;
  border-radius: 6px;
  font-size: 12px;
  white-space: nowrap;
}

.fit-button:hover,
.round-action:hover:not(:disabled) {
  background: #f1f1f1;
}

.round-action {
  width: 27px;
  height: 27px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  color: #303030;
}

.round-action:disabled {
  cursor: not-allowed;
  opacity: 0.34;
}

.pdf-content {
  position: relative;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  background: #f6f6f6;
}

.pdf-pages {
  height: 100%;
  overflow: auto;
  padding: 18px 18px 74px;
  background: #f6f6f6;
}

.pdf-pages :deep(.pdf-page-shell) {
  display: flex;
  justify-content: center;
  width: 100%;
  margin: 0 auto 14px;
}

.pdf-pages :deep(canvas) {
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.12);
}

.pdf-state {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 14px;
  padding: 24px;
  color: #6e7568;
  background: #fff;
  text-align: center;
  font-size: 12px;
}

.progress-line {
  width: 190px;
  height: 2px;
  overflow: hidden;
  background: #eeeeee;
}

.progress-line span {
  display: block;
  width: 42%;
  height: 100%;
  background: #1a1a1a;
  animation: progress 1.45s ease-in-out infinite;
}

.progress-line.muted span {
  background: #d6d6d6;
}

@keyframes progress {
  0% { transform: translateX(-110%); }
  60% { transform: translateX(160%); }
  100% { transform: translateX(160%); }
}

.error-state {
  color: #aa3129;
}

.error-text {
  width: 100%;
  max-height: 180px;
  overflow: auto;
  padding: 12px;
  border-radius: 6px;
  background: #fff5f4;
  border: 1px solid #ffd0cc;
  color: #852720;
  font-family: var(--font-mono);
  font-size: 11px;
  white-space: pre-wrap;
  text-align: left;
}

.floating-pager {
  position: absolute;
  left: 50%;
  bottom: 14px;
  display: inline-flex;
  align-items: center;
  gap: 3px;
  height: 38px;
  padding: 0 9px;
  transform: translateX(-50%);
  border-radius: 999px;
  background: rgba(12, 12, 12, 0.94);
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.26);
}

.floating-pager button {
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #a9a9a9;
  border-radius: 50%;
}

.floating-pager button:hover:not(:disabled) {
  color: #fff;
  background: rgba(255, 255, 255, 0.1);
}

.floating-pager button:disabled {
  cursor: not-allowed;
  opacity: 0.35;
}

@media (max-width: 1080px) {
  .pdf-preview {
    width: 360px;
    min-width: 320px;
    max-width: calc(100vw - 280px);
  }

  .pdf-toolbar {
    grid-template-columns: 1fr auto;
  }

  .pdf-actions {
    display: none;
  }
}
</style>
