import express from 'express'
import cors from 'cors'
import { v4 as uuidv4 } from 'uuid'
import { execFile } from 'child_process'
import { mkdir, writeFile, readFile, rm } from 'fs/promises'
import { join, basename } from 'path'
import { tmpdir } from 'os'

const app = express()
app.use(cors())
app.use(express.json({ limit: '50mb' }))

const PDFTIMEOUT = 30000
const DEFAULT_AI_API_BASE_URL = 'https://api.openai.com/v1'
const DEFAULT_AI_MODEL = 'gpt-4o-mini'

interface CompileRequest {
  files: { path: string; content: string; encoding?: 'utf8' | 'base64' }[]
  mainFile: string
}

interface AiChatRequest {
  messages: { role: string; content: string }[]
  apiKey: string
  apiBaseUrl?: string
  model?: string
}

// Validate file path - no traversal, no absolute paths
function isSafePath(filePath: string): boolean {
  if (filePath.startsWith('/')) return false
  if (filePath.includes('..')) return false
  if (filePath.startsWith('.')) return false
  return true
}

function buildChatCompletionsUrl(baseUrl: string | undefined): string {
  const rawBaseUrl = (baseUrl || DEFAULT_AI_API_BASE_URL).trim()
  const parsed = new URL(rawBaseUrl)
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('API Base URL must use http or https')
  }

  const normalized = parsed.toString().replace(/\/+$/, '')
  if (normalized.endsWith('/chat/completions')) {
    return normalized
  }
  return `${normalized}/chat/completions`
}

// POST /compile - compile LaTeX to PDF
app.post('/compile', async (req, res) => {
  const { files, mainFile } = req.body as CompileRequest

  if (!files || !Array.isArray(files) || files.length === 0) {
    res.status(400).json({ error: 'No files provided' })
    return
  }

  if (!mainFile) {
    res.status(400).json({ error: 'No main file specified' })
    return
  }

  // Validate all paths
  for (const f of files) {
    if (!isSafePath(f.path)) {
      res.status(400).json({ error: `Invalid file path: ${f.path}` })
      return
    }
  }

  const workDir = join(tmpdir(), `latex-${uuidv4()}`)

  try {
    await mkdir(workDir, { recursive: true })

    // Write all files
    for (const f of files) {
      const filePath = join(workDir, f.path)
      const dir = join(filePath, '..')
      await mkdir(dir, { recursive: true })
      const content = f.encoding === 'base64'
        ? Buffer.from(f.content, 'base64')
        : f.content
      await writeFile(filePath, content, f.encoding === 'base64' ? undefined : 'utf-8')
    }

    // Run pdflatex
    const mainPath = join(workDir, mainFile)
    await new Promise<void>((resolve, reject) => {
      execFile(
        'pdflatex',
        ['-interaction=nonstopmode', '-halt-on-error', mainFile],
        {
          cwd: workDir,
          timeout: PDFTIMEOUT,
          maxBuffer: 10 * 1024 * 1024
        },
        (error, stdout, stderr) => {
          if (error) {
            // Parse error from output
            const errorLines = (stdout || '').split('\n').filter(l => l.startsWith('!'))
            const errorMsg = errorLines.length > 0
              ? errorLines.join('\n')
              : stderr || error.message
            reject(new Error(errorMsg))
          } else {
            resolve()
          }
        }
      )
    })

    // Read the PDF
    const pdfName = mainFile.replace(/\.tex$/, '.pdf')
    const pdfPath = join(workDir, pdfName)
    const pdfBuffer = await readFile(pdfPath)

    res.setHeader('Content-Type', 'application/pdf')
    res.send(pdfBuffer)
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Compilation failed' })
  } finally {
    // Cleanup
    try {
      await rm(workDir, { recursive: true, force: true })
    } catch { /* ignore cleanup errors */ }
  }
})

// GET /health - check server and pdflatex availability
app.get('/health', async (_req, res) => {
  try {
    await new Promise<void>((resolve, reject) => {
      execFile('pdflatex', ['--version'], { timeout: 5000 }, (err) => {
        if (err) reject(err)
        else resolve()
      })
    })
    res.json({ status: 'ok', pdflatex: true })
  } catch {
    res.json({ status: 'ok', pdflatex: false })
  }
})

// POST /ai-chat - proxy OpenAI-compatible API requests
app.post('/ai-chat', async (req, res) => {
  const { messages, apiKey, apiBaseUrl, model } = req.body as AiChatRequest

  if (!apiKey) {
    res.status(400).json({ error: '请先在设置中配置 AI API Key' })
    return
  }

  if (!Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: 'No messages provided' })
    return
  }

  try {
    const chatCompletionsUrl = buildChatCompletionsUrl(apiBaseUrl)
    const response = await fetch(chatCompletionsUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model?.trim() || DEFAULT_AI_MODEL,
        messages,
        stream: true
      })
    })

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: { message: 'OpenAI API error' } }))
      res.status(response.status).json({ error: err.error?.message || 'API request failed' })
      return
    }

    // Stream the response
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')

    const reader = response.body?.getReader()
    if (!reader) {
      res.end()
      return
    }

    const decoder = new TextDecoder()
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        res.write(decoder.decode(value, { stream: true }))
      }
    } finally {
      res.end()
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to connect to OpenAI' })
  }
})

const PORT = 3001
app.listen(PORT, () => {
  console.log(`LaTeX compilation server running on http://localhost:${PORT}`)
})
