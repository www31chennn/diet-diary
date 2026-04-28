import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { readDriveFile, writeDriveFile } from '@/lib/drive'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.accessToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const filename = req.nextUrl.searchParams.get('file')
  if (!filename) return NextResponse.json({ error: 'Missing file param' }, { status: 400 })

  try {
    const data = await readDriveFile(session.accessToken, filename)
    return NextResponse.json({ data })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Drive read failed' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.accessToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const filename = req.nextUrl.searchParams.get('file')
  if (!filename) return NextResponse.json({ error: 'Missing file param' }, { status: 400 })

  try {
    const { data } = await req.json()
    await writeDriveFile(session.accessToken, filename, data)
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Drive write failed' }, { status: 500 })
  }
}
