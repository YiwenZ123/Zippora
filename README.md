# Zippora

Zippora 是一个带 AI 助手的 LaTeX 编辑器，提供项目管理、代码编辑、PDF 编译预览和面向 LaTeX 写作的对话式辅助。项目采用 Vue 3 + TypeScript 构建前端，使用 Express 提供 LaTeX 编译和 OpenAI 请求代理。

## 功能特点

- 项目仪表盘：创建、搜索和管理 LaTeX 项目。
- 多文件编辑：内置文件浏览器、编辑器标签页和项目文件状态。
- PDF 编译预览：通过本地 `pdflatex` 编译 `.tex` 文件，并在编辑器内预览 PDF。
- AI LaTeX 助手：在编辑器侧边栏中提问，辅助撰写、调试和优化 LaTeX 文档。
- 本地持久化：项目、设置和聊天记录保存在浏览器本地存储中。
- 前后端分离：前端开发服务器代理 `/api` 请求到后端服务。

## 技术栈

- Frontend: Vue 3, TypeScript, Vite, Pinia, Vue Router, Monaco Editor, PDF.js
- Backend: Node.js, Express, TypeScript, `pdflatex`
- AI: OpenAI Chat Completions API

## 环境要求

请先安装：

- Node.js 18 或更高版本
- npm
- LaTeX 发行版，并确保命令行可直接运行 `pdflatex`
  - Windows: MiKTeX 或 TeX Live
  - macOS: MacTeX
  - Linux: TeX Live

如果只想体验前端页面，可以先不安装 LaTeX；但 PDF 编译功能会不可用。

## 快速开始

安装依赖：

```bash
npm install
npm run install:all
```

启动前端和后端开发服务：

```bash
npm run dev
```

默认服务地址：

- 前端：http://localhost:5173
- 后端：http://localhost:3001
- 健康检查：http://localhost:3001/health

## AI 助手配置

AI 助手需要 OpenAI API Key。当前项目会把 API Key 保存在浏览器本地设置中，并通过本地后端转发到 OpenAI API。

使用前请在应用设置中填写 OpenAI API Key。不要把自己的 API Key 写入源码、提交到 GitHub，或分享给不可信环境。

## LaTeX 编译说明

后端提供 `POST /compile` 接口：

- 接收项目文件列表和主文件名
- 在系统临时目录创建隔离工作区
- 调用 `pdflatex -interaction=nonstopmode -halt-on-error`
- 返回生成的 PDF
- 请求结束后清理临时文件

主文件通常是 `main.tex`。如果 `pdflatex` 没有正确安装，`/health` 会返回 `pdflatex: false`，编辑器内编译也会失败。

## 项目结构

```text
.
├── package.json          # 根开发脚本
├── server/               # Express 后端服务
│   ├── src/index.ts      # 编译接口、健康检查、AI 代理
│   └── package.json
└── src/                  # Vue 前端应用
    ├── src/components/   # 仪表盘、编辑器、PDF 预览、AI 面板
    ├── src/stores/       # Pinia 状态管理
    ├── src/services/     # 本地存储服务
    └── package.json
```

## 常用命令

```bash
# 安装前后端依赖
npm run install:all

# 同时启动前端和后端
npm run dev

# 仅启动前端
npm run dev:frontend

# 仅启动后端
npm run dev:server

# 构建前端
cd src
npm run build
```

## 注意事项

- `node_modules/`、构建产物和本地配置文件不会提交到仓库。
- 后端的 AI 代理当前使用 `gpt-4o-mini`。
- 本项目仍处于早期开发阶段，部分界面文案和设置入口可能还需要继续完善。
