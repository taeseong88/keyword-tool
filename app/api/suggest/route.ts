import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')
  if (!q) return NextResponse.json({ keywords: [] })

  try {
    const res = await fetch(
      `https://ac.search.naver.com/nx/ac?q=${encodeURIComponent(q)}&frm=nv&st=100&r_format=json&r_enc=UTF-8&lang=ko`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Referer': 'https://www.naver.com/',
        },
        cache: 'no-store',
      }
    )
    const data = await res.json()
    const keywords: string[] = (data.items?.[0] ?? []).map((item: unknown[]) => item[0] as string)
    return NextResponse.json({ keywords })
  } catch {
    return NextResponse.json({ keywords: [] })
  }
}
