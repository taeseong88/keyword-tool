'use client'

import { useState } from 'react'
import TrendModal from './components/TrendModal'

interface KeywordData {
  relKeyword: string
  monthlyPcQcCnt: number | string
  monthlyMobileQcCnt: number | string
  compIdx: string
  plAvgDepth: number | string
}

type SortKey = 'total' | 'pc' | 'mobile' | 'relKeyword'
type SortDir = 'asc' | 'desc'

const COMP_LABEL: Record<string, string> = {
  low: '낮음',
  medium: '중간',
  high: '높음',
}

const COMP_COLOR: Record<string, string> = {
  low: 'text-green-600 bg-green-50',
  medium: 'text-yellow-600 bg-yellow-50',
  high: 'text-red-600 bg-red-50',
}

function toNum(val: number | string): number {
  if (val === '< 10') return 5
  return Number(val) || 0
}

function fmt(val: number | string): string {
  if (val === '< 10') return '10 미만'
  const n = Number(val)
  if (isNaN(n)) return '-'
  return n.toLocaleString('ko-KR')
}

export default function Home() {
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [keywords, setKeywords] = useState<KeywordData[]>([])
  const [searched, setSearched] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('total')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [trendKeyword, setTrendKeyword] = useState<string | null>(null)

  async function search() {
    if (!input.trim()) return
    setLoading(true)
    setError('')
    setKeywords([])

    try {
      const res = await fetch(`/api/keywords?keyword=${encodeURIComponent(input.trim())}`)
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || '오류가 발생했습니다.')
        return
      }

      setKeywords(data.keywordList || [])
      setSearched(input.trim())
    } catch {
      setError('네트워크 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  function relevanceScore(kw: string, query: string): number {
    const k = kw.toLowerCase()
    const q = query.toLowerCase()
    const words = q.split(/\s+/).filter(Boolean)
    if (k === q) return 100
    if (k.includes(q)) return 90
    const matchCount = words.filter(w => k.includes(w)).length
    if (matchCount === words.length) return 70 + matchCount
    if (matchCount > 0) return 40 + matchCount * 10
    return 0
  }

  const sorted = [...keywords].sort((a, b) => {
    // 컬럼 클릭 정렬 시에는 연관도 무시
    if (sortKey !== 'total') {
      let va: number | string, vb: number | string
      if (sortKey === 'relKeyword') {
        return sortDir === 'asc'
          ? a.relKeyword.localeCompare(b.relKeyword, 'ko')
          : b.relKeyword.localeCompare(a.relKeyword, 'ko')
      }
      if (sortKey === 'pc') { va = toNum(a.monthlyPcQcCnt); vb = toNum(b.monthlyPcQcCnt) }
      else { va = toNum(a.monthlyMobileQcCnt); vb = toNum(b.monthlyMobileQcCnt) }
      return sortDir === 'asc' ? (va as number) - (vb as number) : (vb as number) - (va as number)
    }

    // 기본 정렬: 연관도 우선, 같은 연관도 내에서 검색량 순
    const ra = relevanceScore(a.relKeyword, searched)
    const rb = relevanceScore(b.relKeyword, searched)
    if (ra !== rb) return sortDir === 'desc' ? rb - ra : ra - rb
    const ta = toNum(a.monthlyPcQcCnt) + toNum(a.monthlyMobileQcCnt)
    const tb = toNum(b.monthlyPcQcCnt) + toNum(b.monthlyMobileQcCnt)
    return sortDir === 'desc' ? tb - ta : ta - tb
  })

  function SortBtn({ col, label }: { col: SortKey; label: string }) {
    const active = sortKey === col
    return (
      <button
        onClick={() => handleSort(col)}
        className={`flex items-center gap-1 hover:text-blue-600 transition-colors ${active ? 'text-blue-600 font-semibold' : ''}`}
      >
        {label}
        <span className="text-xs">
          {active ? (sortDir === 'desc' ? '▼' : '▲') : '↕'}
        </span>
      </button>
    )
  }

  function exportCSV() {
    const header = '연관키워드,PC 검색량,모바일 검색량,총 검색량,경쟁도'
    const rows = sorted.map(k => {
      const total = toNum(k.monthlyPcQcCnt) + toNum(k.monthlyMobileQcCnt)
      return `${k.relKeyword},${fmt(k.monthlyPcQcCnt)},${fmt(k.monthlyMobileQcCnt)},${total.toLocaleString('ko-KR')},${COMP_LABEL[k.compIdx] ?? k.compIdx}`
    })
    const csv = '\uFEFF' + [header, ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${searched}_키워드분석.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <main className="max-w-5xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold text-gray-800 mb-2">네이버 키워드 검색량 분석</h1>
      <p className="text-gray-500 text-sm mb-8">키워드를 입력하면 연관 키워드와 월간 검색량을 조회합니다.</p>

      {/* 검색창 */}
      <div className="flex gap-2 mb-8">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && search()}
          placeholder="키워드 입력 (예: 러닝화)"
          className="flex-1 border border-gray-300 rounded-lg px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        />
        <button
          onClick={search}
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white px-6 py-3 rounded-lg font-medium transition-colors"
        >
          {loading ? '조회 중...' : '검색'}
        </button>
      </div>

      {/* 오류 */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      {/* 결과 */}
      {sorted.length > 0 && (
        <>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-gray-600">
              <span className="font-semibold text-gray-800">"{searched}"</span> 연관 키워드{' '}
              <span className="font-semibold text-blue-600">{sorted.length}개</span>
            </p>
            <button
              onClick={exportCSV}
              className="text-sm text-blue-600 hover:text-blue-800 border border-blue-300 hover:border-blue-500 px-3 py-1.5 rounded-lg transition-colors"
            >
              CSV 다운로드
            </button>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 text-gray-600 font-medium w-8">#</th>
                    <th className="text-left px-4 py-3 text-gray-600 font-medium">
                      <SortBtn col="relKeyword" label="연관 키워드" />
                    </th>
                    <th className="text-right px-4 py-3 text-gray-600 font-medium">
                      <SortBtn col="pc" label="PC 검색량" />
                    </th>
                    <th className="text-right px-4 py-3 text-gray-600 font-medium">
                      <SortBtn col="mobile" label="모바일 검색량" />
                    </th>
                    <th className="text-right px-4 py-3 text-gray-600 font-medium">
                      <SortBtn col="total" label="총 검색량" />
                    </th>
                    <th className="text-center px-4 py-3 text-gray-600 font-medium">경쟁도</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {sorted.map((k, i) => {
                    const total = toNum(k.monthlyPcQcCnt) + toNum(k.monthlyMobileQcCnt)
                    return (
                      <tr key={k.relKeyword} className="hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => setTrendKeyword(k.relKeyword)}>
                        <td className="px-4 py-3 text-gray-400">{i + 1}</td>
                        <td className="px-4 py-3 font-medium text-blue-700 hover:underline">{k.relKeyword}</td>
                        <td className="px-4 py-3 text-right text-gray-600">{fmt(k.monthlyPcQcCnt)}</td>
                        <td className="px-4 py-3 text-right text-gray-600">{fmt(k.monthlyMobileQcCnt)}</td>
                        <td className="px-4 py-3 text-right font-semibold text-gray-800">{total.toLocaleString('ko-KR')}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${COMP_COLOR[k.compIdx] ?? 'text-gray-600 bg-gray-100'}`}>
                            {COMP_LABEL[k.compIdx] ?? k.compIdx}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {trendKeyword && (
        <TrendModal keyword={trendKeyword} onClose={() => setTrendKeyword(null)} />
      )}

      {!loading && searched && sorted.length === 0 && !error && (
        <p className="text-center text-gray-400 py-12">연관 키워드가 없습니다.</p>
      )}
    </main>
  )
}
