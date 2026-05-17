'use client'

import { useState, useRef } from 'react'

type Change = { type: string; description: string }
type Result = {
  role_title: string
  company: string
  tailored_cv: string
  changes: Change[]
}

type Step = 'input' | 'loading' | 'result'

const BADGE_STYLES: Record<string, string> = {
  summary: 'bg-blue-100 text-blue-800',
  bullet:  'bg-green-100 text-green-800',
  order:   'bg-amber-100 text-amber-800',
  skills:  'bg-purple-100 text-purple-800',
  note:    'bg-gray-100 text-gray-700',
}

export default function Home() {
  const [step, setStep] = useState<Step>('input')
  const [apiKey, setApiKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [files, setFiles] = useState<File[]>([])
  const [jdText, setJdText] = useState('')
  const [jdMode, setJdMode] = useState<'paste' | 'url'>('paste')
  const [jdUrl, setJdUrl] = useState('')
  const [statusMsg, setStatusMsg] = useState('')
  const [result, setResult] = useState<Result | null>(null)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || [])
    setFiles(prev => {
      const names = new Set(prev.map(f => f.name))
      return [...prev, ...selected.filter(f => !names.has(f.name))]
    })
  }

  const removeFile = (name: string) => setFiles(prev => prev.filter(f => f.name !== name))

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const dropped = Array.from(e.dataTransfer.files)
    setFiles(prev => {
      const names = new Set(prev.map(f => f.name))
      return [...prev, ...dropped.filter(f => !names.has(f.name))]
    })
  }

  const handleSubmit = async () => {
    setError('')
    if (!apiKey.trim()) { setError('Please enter your Groq API key.'); return }
    if (files.length === 0) { setError('Please upload at least one CV or experience file.'); return }
    if (!jdText.trim() && jdMode === 'paste') { setError('Please paste a job description.'); return }
    if (!jdUrl.trim() && jdMode === 'url') { setError('Please enter a job URL.'); return }

    setStep('loading')
    setStatusMsg('Parsing your CV files...')

    try {
      // Step 1: Parse uploaded files
      const formData = new FormData()
      files.forEach(f => formData.append('files', f))
      const parseRes = await fetch('/api/parse-cv', { method: 'POST', body: formData })
      const parseData = await parseRes.json()
      if (!parseRes.ok) throw new Error(parseData.error || 'Failed to parse files')

      // Step 2: Resolve JD
      let jd = jdText
      if (jdMode === 'url') {
        setStatusMsg('Fetching job description from URL...')
        try {
          const r = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(jdUrl)}`)
          const d = await r.json()
          jd = d.contents?.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 6000) || ''
          if (!jd) throw new Error('Could not extract content')
        } catch {
          throw new Error('Could not fetch that URL. Please paste the job description instead.')
        }
      }

      // Step 3: Tailor CV
      setStatusMsg('Tailoring your CV with AI...')
      const tailorRes = await fetch('/api/tailor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cvText: parseData.text, jobDescription: jd, apiKey })
      })
      const tailorData = await tailorRes.json()
      if (!tailorRes.ok) throw new Error(tailorData.error || 'Failed to tailor CV')

      setResult(tailorData)
      setStep('result')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Something went wrong.'
      setError(msg)
      setStep('input')
    }
  }

  const downloadPDF = async () => {
    if (!result) return
    const { PDFDocument, rgb, StandardFonts } = await import('pdf-lib')

    const doc = await PDFDocument.create()
    const fontBold = await doc.embedFont(StandardFonts.HelveticaBold)
    const fontReg  = await doc.embedFont(StandardFonts.Helvetica)

    const NAVY  = rgb(0.122, 0.220, 0.392)
    const BLUE  = rgb(0.180, 0.459, 0.714)
    const DARK  = rgb(0.18, 0.18, 0.18)
    const LGRAY = rgb(0.7, 0.7, 0.7)

    const W = 612, H = 792
    const ML = 54, MR = 54, MT = 54, MB = 54
    const contentW = W - ML - MR

    let page = doc.addPage([W, H])
    let y = H - MT

    const newPage = () => {
      page = doc.addPage([W, H])
      y = H - MT
    }

    const checkY = (needed: number) => { if (y - needed < MB) newPage() }

    const drawText = (text: string, x: number, size: number, font: typeof fontBold, color: typeof DARK, maxW: number) => {
      const words = text.split(' ')
      let line = ''
      const lines: string[] = []
      for (const w of words) {
        const test = line ? line + ' ' + w : w
        if (font.widthOfTextAtSize(test, size) > maxW) {
          if (line) lines.push(line)
          line = w
        } else {
          line = test
        }
      }
      if (line) lines.push(line)
      for (const l of lines) {
        checkY(size + 4)
        page.drawText(l, { x, y, size, font, color })
        y -= size + 4
      }
    }

    const lines = result.tailored_cv.split('\n')

    for (const rawLine of lines) {
      const line = rawLine.trim()
      if (!line) { y -= 6; continue }

      // Section headers (all caps, short)
      if (line === line.toUpperCase() && line.length > 3 && line.length < 50 && !line.startsWith('•') && !line.startsWith('-')) {
        checkY(28)
        y -= 8
        drawText(line, ML, 11, fontBold, NAVY, contentW)
        // underline
        page.drawLine({ start: { x: ML, y: y + 2 }, end: { x: W - MR, y: y + 2 }, thickness: 1.2, color: BLUE })
        y -= 6
        continue
      }

      // Bullet points
      if (line.startsWith('•') || line.startsWith('-')) {
        const text = line.replace(/^[•\-]\s*/, '')
        const bx = ML + 12
        checkY(14)
        page.drawText('•', { x: ML, y, size: 10, font: fontReg, color: DARK })
        drawText(text, bx, 10, fontReg, DARK, contentW - 12)
        continue
      }

      // Name line (first non-empty line, assume it's the name)
      if (y > H - MT - 20) {
        checkY(22)
        drawText(line, ML, 18, fontBold, NAVY, contentW)
        // decorative line under name
        page.drawLine({ start: { x: ML, y: y + 4 }, end: { x: W - MR, y: y + 4 }, thickness: 0.5, color: LGRAY })
        y -= 4
        continue
      }

      // Contact / banner line (contains •)
      if (line.includes('•') && line.includes('@')) {
        checkY(12)
        drawText(line, ML, 9, fontReg, rgb(0.4, 0.4, 0.4), contentW)
        continue
      }

      // Job title lines (contain comma and year)
      if ((line.includes('20') && (line.includes('–') || line.includes('-'))) || line.includes('Present')) {
        checkY(16)
        y -= 4
        drawText(line, ML, 11, fontBold, NAVY, contentW)
        continue
      }

      // Italic company description (short lines after job title)
      if (line.length < 80 && !line.includes(':')) {
        checkY(13)
        drawText(line, ML, 9, fontReg, rgb(0.45, 0.45, 0.45), contentW)
        continue
      }

      // Skill rows (contain colon)
      if (line.includes(':') && line.indexOf(':') < 30) {
        const colonIdx = line.indexOf(':')
        const label = line.slice(0, colonIdx + 1)
        const rest = line.slice(colonIdx + 1)
        checkY(14)
        const labelW = fontBold.widthOfTextAtSize(label, 10)
        page.drawText(label, { x: ML, y, size: 10, font: fontBold, color: NAVY })
        drawText(rest.trim(), ML + labelW + 4, 10, fontReg, DARK, contentW - labelW - 4)
        continue
      }

      // Default body text
      drawText(line, ML, 10, fontReg, DARK, contentW)
    }

    const pdfBytes = await doc.save()
    const blob = new Blob([pdfBytes], { type: 'application/pdf' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `CV_${(result.role_title || 'tailored').replace(/\s+/g, '_')}.pdf`
    a.click()
    URL.revokeObjectURL(url)
  }

  const copyText = () => {
    if (result) navigator.clipboard.writeText(result.tailored_cv)
  }

  const reset = () => {
    setStep('input')
    setResult(null)
    setFiles([])
    setJdText('')
    setJdUrl('')
    setError('')
  }

  // ── PROGRESS BAR ──
  const progress = step === 'input' ? 33 : step === 'loading' ? 66 : 100

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">CV Tailor</h1>
            <p className="text-xs text-gray-500">AI-powered CV customisation — free, private, instant</p>
          </div>
          <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium">Powered by Groq</span>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Progress */}
        <div className="h-1 bg-gray-200 rounded-full mb-8 overflow-hidden">
          <div className="h-full bg-blue-600 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>

        {/* ── STEP: INPUT ── */}
        {step === 'input' && (
          <div className="space-y-4">

            {/* API Key */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">Groq API Key</span>
                <a href="https://console.groq.com" target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline ml-auto">Get free key ↗</a>
              </div>
              <div className="flex gap-2">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={e => setApiKey(e.target.value)}
                  placeholder="gsk_..."
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                />
                <button onClick={() => setShowKey(s => !s)} className="px-3 py-2 border border-gray-200 rounded-lg text-xs text-gray-500 hover:bg-gray-50">
                  {showKey ? 'Hide' : 'Show'}
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-2">Your key is used only for this request and never stored.</p>
            </div>

            {/* File Upload */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">Your CV & Experience Files</div>
              <div
                className="border-2 border-dashed border-gray-200 rounded-lg p-6 text-center hover:border-blue-300 transition-colors cursor-pointer"
                onClick={() => fileRef.current?.click()}
                onDrop={handleDrop}
                onDragOver={e => e.preventDefault()}
              >
                <div className="text-2xl mb-2">📄</div>
                <p className="text-sm text-gray-600 font-medium">Drop files here or click to upload</p>
                <p className="text-xs text-gray-400 mt-1">Supports DOCX, PDF, TXT — upload multiple files</p>
                <input ref={fileRef} type="file" multiple accept=".docx,.pdf,.txt,.md" onChange={handleFiles} className="hidden" />
              </div>
              {files.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {files.map(f => (
                    <div key={f.name} className="flex items-center gap-1.5 bg-blue-50 border border-blue-100 rounded-full px-3 py-1">
                      <span className="text-xs text-blue-700 font-medium">{f.name}</span>
                      <button onClick={() => removeFile(f.name)} className="text-blue-400 hover:text-blue-700 text-xs leading-none">×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Job Description */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">Job Description</div>
              <div className="flex gap-1 mb-3 border-b border-gray-100">
                {(['paste', 'url'] as const).map(m => (
                  <button key={m} onClick={() => setJdMode(m)}
                    className={`px-3 py-1.5 text-sm capitalize border-b-2 transition-colors ${jdMode === m ? 'border-blue-600 text-blue-700 font-medium' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
                    {m === 'paste' ? 'Paste Text' : 'URL'}
                  </button>
                ))}
              </div>
              {jdMode === 'paste' ? (
                <textarea
                  value={jdText}
                  onChange={e => setJdText(e.target.value)}
                  rows={7}
                  placeholder="Paste the full job description here — role title, responsibilities, requirements, keywords..."
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400 resize-y"
                />
              ) : (
                <input
                  type="text"
                  value={jdUrl}
                  onChange={e => setJdUrl(e.target.value)}
                  placeholder="https://company.com/careers/product-manager"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                />
              )}
            </div>

            {error && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{error}</div>}

            <button onClick={handleSubmit}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl text-sm transition-colors">
              Tailor My CV ↗
            </button>
          </div>
        )}

        {/* ── STEP: LOADING ── */}
        {step === 'loading' && (
          <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
            <div className="inline-block w-10 h-10 border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin mb-4" />
            <p className="text-sm font-medium text-gray-700">{statusMsg}</p>
            <p className="text-xs text-gray-400 mt-2">This usually takes 10–20 seconds</p>
          </div>
        )}

        {/* ── STEP: RESULT ── */}
        {step === 'result' && result && (
          <div className="space-y-4">
            {/* Role badge */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">Tailored for</div>
              <div className="text-lg font-bold text-gray-900">{result.role_title}{result.company ? ` — ${result.company}` : ''}</div>
            </div>

            {/* Changes */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">What was changed</div>
              <div className="space-y-2">
                {result.changes.map((c, i) => (
                  <div key={i} className="flex gap-3 items-start text-sm">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold whitespace-nowrap mt-0.5 ${BADGE_STYLES[c.type] || BADGE_STYLES.note}`}>
                      {c.type}
                    </span>
                    <span className="text-gray-700">{c.description}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* CV Preview */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">Tailored CV — Preview</div>
              <pre className="text-xs text-gray-600 font-mono whitespace-pre-wrap bg-gray-50 rounded-lg p-4 max-h-72 overflow-y-auto leading-relaxed">
                {result.tailored_cv}
              </pre>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button onClick={downloadPDF}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl text-sm transition-colors">
                Download PDF ↓
              </button>
              <button onClick={copyText}
                className="px-5 py-3 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                Copy Text
              </button>
              <button onClick={reset}
                className="px-5 py-3 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                New CV
              </button>
            </div>

            <p className="text-xs text-center text-gray-400">Your files and API key are never stored. Everything is processed in-session only.</p>
          </div>
        )}
      </div>
    </main>
  )
}
