import type { VirtualFile } from '../types/project'
import { generateId } from './id'

function file(name: string, content: string, parentId: string | null = null): VirtualFile {
  return { id: generateId(), name, type: 'file', parentId, content }
}

function folder(name: string, children: VirtualFile[], parentId: string | null = null): VirtualFile {
  const id = generateId()
  return {
    id,
    name,
    type: 'folder',
    parentId,
    content: '',
    children: children.map(c => ({ ...c, parentId: id }))
  }
}

export const templates = {
  article: () => [
    file('main.tex', `\\documentclass[12pt,a4paper]{article}
\\usepackage[utf8]{inputenc}
\\usepackage{graphicx}
\\usepackage{amsmath}
\\usepackage{hyperref}

\\title{Your Title}
\\author{Your Name}
\\date{\\today}

\\begin{document}

\\maketitle

\\begin{abstract}
Your abstract here.
\\end{abstract}

\\section{Introduction}
Start writing here.

\\section{Methods}

\\section{Results}

\\section{Conclusion}

\\end{document}
`)
  ],

  thesis: () => [
    file('main.tex', `\\documentclass[12pt,a4paper]{report}
\\usepackage[utf8]{inputenc}
\\usepackage{graphicx}
\\usepackage{amsmath}
\\usepackage{amssymb}
\\usepackage{hyperref}
\\usepackage{setspace}
\\usepackage{geometry}
\\geometry{margin=1in}

\\title{Thesis Title}
\\author{Your Name}
\\date{\\today}

\\begin{document}

\\maketitle

\\begin{abstract}
Your thesis abstract goes here.
\\end{abstract}

\\tableofcontents

\\input{chapters/chapter1}
\\input{chapters/chapter2}
\\input{chapters/chapter3}

\\bibliographystyle{plain}
\\bibliography{references}

\\end{document}
`),
    folder('chapters', [
      file('chapter1.tex', `\\chapter{Introduction}
\\label{ch:intro}

This is the introduction chapter.

\\section{Background}
Provide background information here.

\\section{Objectives}
State your research objectives.
`),
      file('chapter2.tex', `\\chapter{Literature Review}
\\label{ch:litreview}

\\section{Overview}
Review relevant literature here.
`),
      file('chapter3.tex', `\\chapter{Conclusion}
\\label{ch:conclusion}

\\section{Summary}
Summarize your findings.
`)
    ]),
    file('references.bib', `@article{example2024,
  author  = {Author Name},
  title   = {Example Article Title},
  journal = {Journal Name},
  year    = {2024},
  volume  = {1},
  pages   = {1--10}
}
`)
  ],

  blank: () => [
    file('main.tex', `\\documentclass{article}
\\usepackage[utf8]{inputenc}

\\begin{document}

Hello, World!

\\end{document}
`)
  ]
}

export type TemplateName = keyof typeof templates
