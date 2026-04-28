import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { apiKey, prompt, imageBase64 } = await req.json()
  if (!apiKey || !prompt) {
    return NextResponse.json({ error: 'Missing apiKey or prompt' }, { status: 400 })
  }

  const messages: unknown[] = []

  if (imageBase64) {
    messages.push({
      role: 'user',
      parts: [
        { inline_data: { mime_type: 'image/jpeg', data: imageBase64 } },
        { text: prompt },
      ],
    })
  } else {
    messages.push({ role: 'user', parts: [{ text: prompt }] })
  }

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-preview:generateContent?key=${apiKey}`
    console.log('[Gemini] Calling API, imageBase64 length:', imageBase64?.length ?? 0)

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: messages }),
    })

    const data = await res.json()
    console.log('[Gemini] Status:', res.status)
    console.log('[Gemini] Response:', JSON.stringify(data).slice(0, 500))

    if (!res.ok) {
      return NextResponse.json({ error: data?.error?.message ?? 'Gemini error', detail: data }, { status: 500 })
    }

    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    console.log('[Gemini] Result text:', text)
    return NextResponse.json({ text })
  } catch (e) {
    console.error('[Gemini] Exception:', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}