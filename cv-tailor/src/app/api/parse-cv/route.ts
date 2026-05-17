import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 30

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const files = formData.getAll('files') as File[]

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 })
    }

    let combinedText = ''

    for (const file of files) {
      const bytes = await file.arrayBuffer()
      const buffer = Buffer.from(bytes)
      const fileName = file.name.toLowerCase()

      if (fileName.endsWith('.docx')) {
        const mammoth = await import('mammoth')
        const result = await mammoth.extractRawText({ buffer })
        combinedText += `\n\n=== ${file.name} ===\n${result.value}`
      } else if (fileName.endsWith('.txt') || fileName.endsWith('.md')) {
        combinedText += `\n\n=== ${file.name} ===\n${buffer.toString('utf-8')}`
      } else if (fileName.endsWith('.pdf')) {
        // Basic PDF text extraction via raw buffer scan
        const text = buffer.toString('latin1')
        const matches = text.match(/BT[\s\S]*?ET/g) || []
        const extracted = matches
          .join(' ')
          .replace(/\(([^)]+)\)\s*Tj/g, '$1 ')
          .replace(/[^\x20-\x7E\n]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
        combinedText += `\n\n=== ${file.name} ===\n${extracted.slice(0, 8000)}`
      }
    }

    return NextResponse.json({ text: combinedText.trim() })
  } catch (err) {
    console.error('Parse error:', err)
    return NextResponse.json({ error: 'Failed to parse files' }, { status: 500 })
  }
}
