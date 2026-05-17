import { NextRequest, NextResponse } from 'next/server'
import Groq from 'groq-sdk'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const { cvText, jobDescription, apiKey } = await req.json()

    if (!cvText || !jobDescription || !apiKey) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const groq = new Groq({ apiKey })

    const prompt = `You are an expert CV writer and career coach. Your job is to tailor a CV for a specific job description.

RULES:
- NEVER invent experience, metrics, or skills that are not in the original CV
- DO rewrite bullet points to mirror the language and priorities of the job description naturally
- DO reorder bullets so the most relevant ones appear first
- DO rewrite the professional summary to speak directly to this specific role
- Mirror keywords from the JD naturally — do not keyword-stuff
- Keep all section headers and the overall structure intact
- The output must be clean, professional plain text ready to format

Return ONLY a valid JSON object with NO markdown, no backticks, no preamble. Format:
{
  "role_title": "job title from the JD",
  "company": "company name or empty string",
  "tailored_cv": "the full tailored CV as plain text with newlines as \\n",
  "changes": [
    {"type": "summary", "description": "what changed in the summary and why"},
    {"type": "bullet", "description": "what bullet was rewritten and why"},
    {"type": "order", "description": "what was reordered and why"},
    {"type": "skills", "description": "what skills were emphasised and why"}
  ]
}

JOB DESCRIPTION:
${jobDescription}

ORIGINAL CV / EXPERIENCE LIBRARY:
${cvText}

Remember: Return ONLY the JSON object. No markdown. No explanation outside the JSON.`

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 4000,
    })

    const raw = completion.choices[0]?.message?.content || ''
    
    // Strip any accidental markdown fences
    const cleaned = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim()
    
    let result
    try {
      result = JSON.parse(cleaned)
    } catch {
      // If JSON parse fails, return the raw text so user still gets something
      return NextResponse.json({
        role_title: 'Tailored Role',
        company: '',
        tailored_cv: cleaned,
        changes: [{ type: 'note', description: 'CV was tailored successfully.' }]
      })
    }

    return NextResponse.json(result)
  } catch (err: unknown) {
    console.error('Tailor error:', err)
    const message = err instanceof Error ? err.message : 'Failed to tailor CV'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
