import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'

const CUSTOMER_ID = process.env.NAVER_CUSTOMER_ID!
const ACCESS_LICENSE = process.env.NAVER_ACCESS_LICENSE!
const SECRET_KEY = process.env.NAVER_SECRET_KEY!

function getSignature(timestamp: string, method: string, uri: string): string {
  const message = `${timestamp}.${method}.${uri}`
  return crypto.createHmac('sha256', SECRET_KEY).update(message).digest('base64')
}

export async function GET(req: NextRequest) {
  const keyword = req.nextUrl.searchParams.get('keyword')
  if (!keyword) {
    return NextResponse.json({ error: '키워드를 입력해주세요.' }, { status: 400 })
  }

  const hints = keyword.trim()

  const timestamp = Date.now().toString()
  const method = 'GET'
  const uri = '/keywordstool'
  const signature = getSignature(timestamp, method, uri)

  const apiUrl = `https://api.naver.com/keywordstool?hintKeywords=${encodeURIComponent(hints)}&showDetail=1`

  const res = await fetch(apiUrl, {
    headers: {
      'X-Timestamp': timestamp,
      'X-API-KEY': ACCESS_LICENSE,
      'X-Customer': CUSTOMER_ID,
      'X-Signature': signature,
      'Content-Type': 'application/json; charset=UTF-8',
    },
    redirect: 'follow',
    cache: 'no-store',
  })

  const text = await res.text()

  if (!res.ok) {
    return NextResponse.json({ error: `API 오류: ${res.status} — ${text}` }, { status: res.status })
  }

  try {
    return NextResponse.json(JSON.parse(text))
  } catch {
    return NextResponse.json({ error: '응답 파싱 오류', raw: text }, { status: 500 })
  }
}
