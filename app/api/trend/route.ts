import { NextRequest, NextResponse } from 'next/server'

const CLIENT_ID = process.env.NAVER_DATALAB_CLIENT_ID!
const CLIENT_SECRET = process.env.NAVER_DATALAB_CLIENT_SECRET!

export async function GET(req: NextRequest) {
  const keyword = req.nextUrl.searchParams.get('keyword')
  if (!keyword) {
    return NextResponse.json({ error: '키워드를 입력해주세요.' }, { status: 400 })
  }

  const endDate = new Date()
  const startDate = new Date()
  startDate.setFullYear(endDate.getFullYear() - 1)

  const fmt = (d: Date) => d.toISOString().slice(0, 10)

  const body = {
    startDate: fmt(startDate),
    endDate: fmt(endDate),
    timeUnit: 'month',
    keywordGroups: [{ groupName: keyword, keywords: [keyword] }],
  }

  try {
    const res = await fetch('https://openapi.naver.com/v1/datalab/search', {
      method: 'POST',
      headers: {
        'X-Naver-Client-Id': CLIENT_ID,
        'X-Naver-Client-Secret': CLIENT_SECRET,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const text = await res.text()
      return NextResponse.json({ error: `DataLab 오류: ${res.status} — ${text}` }, { status: res.status })
    }

    const data = await res.json()
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: '네트워크 오류가 발생했습니다.' }, { status: 500 })
  }
}
