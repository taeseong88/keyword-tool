import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

const API_KEY = process.env.SERP_API_KEY!

interface SerpTimelineEntry {
  timestamp: string
  values: { extracted_value: number }[]
}

async function fetchSerpTrend(keyword: string, gprop: string = ''): Promise<{ period: string; value: number }[]> {
  const params = new URLSearchParams({
    engine: 'google_trends',
    q: keyword,
    geo: 'KR',
    hl: 'ko',
    date: 'today 12-m',
    data_type: 'TIMESERIES',
    api_key: API_KEY,
  })
  if (gprop) params.set('gprop', gprop)

  const res = await fetch(`https://serpapi.com/search.json?${params}`, { cache: 'no-store' })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`SerpAPI 오류 ${res.status}: ${text.slice(0, 100)}`)
  }

  const json = await res.json()
  const timeline: SerpTimelineEntry[] = json.interest_over_time?.timeline_data ?? []

  // 주간 데이터를 월별로 집계
  const map = new Map<string, number[]>()
  for (const entry of timeline) {
    const month = new Date(Number(entry.timestamp) * 1000).toISOString().slice(0, 7)
    const val = entry.values?.[0]?.extracted_value ?? 0
    if (!map.has(month)) map.set(month, [])
    map.get(month)!.push(val)
  }

  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([period, vals]) => ({
      period,
      value: Math.round(vals.reduce((s, v) => s + v, 0) / vals.length),
    }))
}

export async function GET(req: NextRequest) {
  const keyword = req.nextUrl.searchParams.get('keyword')
  if (!keyword) return NextResponse.json({ error: '키워드 없음' }, { status: 400 })

  if (!API_KEY) {
    return NextResponse.json({ error: 'SERP_API_KEY 환경변수가 없습니다' }, { status: 500 })
  }

  try {
    const [webData, ytData] = await Promise.all([
      fetchSerpTrend(keyword, ''),
      fetchSerpTrend(keyword, 'youtube'),
    ])
    return NextResponse.json({ web: webData, youtube: ytData })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '구글 트렌드 오류'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
