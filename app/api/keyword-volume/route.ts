import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'

const CUSTOMER_ID = process.env.NAVER_CUSTOMER_ID!
const ACCESS_LICENSE = process.env.NAVER_ACCESS_LICENSE!
const SECRET_KEY = process.env.NAVER_SECRET_KEY!

function getSignature(timestamp: string, method: string, uri: string): string {
  const message = `${timestamp}.${method}.${uri}`
  return crypto.createHmac('sha256', SECRET_KEY).update(message).digest('base64')
}

// hintKeywords 쉼표 묶음으로 최대 5개 키워드의 검색량 일괄 조회
export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get('keywords') ?? ''
  const keywords = raw.split(',').map(k => k.trim()).filter(Boolean).slice(0, 5)
  if (keywords.length === 0) {
    return NextResponse.json({ error: '키워드를 입력해주세요.' }, { status: 400 })
  }

  const timestamp = Date.now().toString()
  const method = 'GET'
  const uri = '/keywordstool'
  const signature = getSignature(timestamp, method, uri)

  const apiUrl = `https://api.naver.com/keywordstool?hintKeywords=${encodeURIComponent(keywords.join(','))}&showDetail=1`

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
