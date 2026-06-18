'use client'

import { useState, useEffect, useRef } from 'react'
import TrendModal from './components/TrendModal'
import VideoDownload from './components/VideoDownload'

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

type Tab = 'keyword' | 'favorites' | 'linkedin' | 'youtube' | 'vimeo'

export default function Home() {
  const [tab, setTab] = useState<Tab>('keyword')
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [keywords, setKeywords] = useState<KeywordData[]>([])
  const [searched, setSearched] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('total')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [trendKeyword, setTrendKeyword] = useState<string | null>(null)
  const [history, setHistory] = useState<string[]>([])
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [favorites, setFavorites] = useState<KeywordData[]>([])
  const [bulkInput, setBulkInput] = useState('')
  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number } | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    try {
      const saved = localStorage.getItem('kw-favorites')
      if (saved) setFavorites(JSON.parse(saved))
    } catch {}
  }, [])

  // 최신 fetchKeywords를 ref로 유지 (popstate 클로저 문제 방지)
  const fetchKeywordsRef = useRef(fetchKeywords)
  fetchKeywordsRef.current = fetchKeywords

  // 초기 로드 시 URL의 q 파라미터 복원
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get('q')
    if (q) {
      fetchKeywordsRef.current(q)
    }
    // 현재 위치를 히스토리에 등록 (뒤로 가기로 돌아올 빈 상태 보장)
    window.history.replaceState({ query: q ?? null, appHistory: [] }, '')
  }, [])

  // 브라우저 뒤로/앞으로 가기 처리
  useEffect(() => {
    function onPopState(e: PopStateEvent) {
      const state = e.state as { query: string | null; appHistory: string[] } | null
      if (state?.query) {
        setHistory(state.appHistory ?? [])
        fetchKeywordsRef.current(state.query)
      } else {
        setKeywords([])
        setSearched('')
        setInput('')
        setHistory([])
        setSuggestions([])
      }
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  async function fetchKeywords(query: string) {
    setLoading(true)
    setError('')
    setKeywords([])
    setSuggestions([])

    try {
      const [kwRes, sugRes] = await Promise.all([
        fetch(`/api/keywords?keyword=${encodeURIComponent(query)}`),
        fetch(`/api/suggest?q=${encodeURIComponent(query)}`),
      ])
      const kwData = await kwRes.json()

      if (!kwRes.ok) {
        setError(kwData.error || '오류가 발생했습니다.')
        return
      }

      setKeywords(kwData.keywordList || [])
      setSearched(query)
      setInput(query)

      if (sugRes.ok) {
        const sugData = await sugRes.json()
        setSuggestions(sugData.keywords || [])
      }
    } catch {
      setError('네트워크 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  async function handleBulkAdd() {
    const lines = bulkInput.split('\n').map(l => l.trim()).filter(Boolean)
    const unique = [...new Set(lines)]
    const toAdd = unique.filter(kw => !favorites.some(f => f.relKeyword === kw))
    if (toAdd.length === 0) { setBulkOpen(false); return }

    setBulkProgress({ done: 0, total: toAdd.length })
    const results: KeywordData[] = []

    const norm = (s: string) => s.normalize('NFC').trim().replace(/\s+/g, '').toLowerCase()
    for (let i = 0; i < toAdd.length; i++) {
      const kw = toAdd[i]
      try {
        const res = await fetch(`/api/keywords?keyword=${encodeURIComponent(kw)}`)
        if (res.ok) {
          const data = await res.json()
          const list: KeywordData[] = data.keywordList || []
          const match = list.find(k => k.relKeyword === kw)
            ?? list.find(k => norm(k.relKeyword) === norm(kw))
            ?? (list.length > 0 ? list[0] : null)
          results.push(match ? { ...match, relKeyword: kw } : { relKeyword: kw, monthlyPcQcCnt: 0, monthlyMobileQcCnt: 0, compIdx: '', plAvgDepth: 0 })
        } else {
          results.push({ relKeyword: kw, monthlyPcQcCnt: 0, monthlyMobileQcCnt: 0, compIdx: '', plAvgDepth: 0 })
        }
      } catch {
        results.push({ relKeyword: kw, monthlyPcQcCnt: 0, monthlyMobileQcCnt: 0, compIdx: '', plAvgDepth: 0 })
      }
      setBulkProgress({ done: i + 1, total: toAdd.length })
    }

    setFavorites(prev => {
      const next = [...prev, ...results.filter(r => !prev.some(p => p.relKeyword === r.relKeyword))]
      try { localStorage.setItem('kw-favorites', JSON.stringify(next)) } catch {}
      return next
    })
    setBulkProgress(null)
    setBulkInput('')
    setBulkOpen(false)
  }

  async function refreshFavorites() {
    if (favorites.length === 0) return
    setRefreshing(true)
    const norm = (s: string) => s.normalize('NFC').trim().replace(/\s+/g, '').toLowerCase()
    const updated = favorites.map(f => ({ ...f }))
    // 검색량이 0인 항목만 재조회
    const zeroIndices = updated
      .map((f, i) => ({ f, i }))
      .filter(({ f }) => toNum(f.monthlyPcQcCnt) === 0 && toNum(f.monthlyMobileQcCnt) === 0)
      .map(({ i }) => i)

    for (const i of zeroIndices) {
      const kw = updated[i].relKeyword
      try {
        const res = await fetch(`/api/keywords?keyword=${encodeURIComponent(kw)}`)
        if (res.ok) {
          const data = await res.json()
          const list: KeywordData[] = data.keywordList || []
          const match = list.find(k => k.relKeyword === kw)
            ?? list.find(k => norm(k.relKeyword) === norm(kw))
            ?? (list.length > 0 ? list[0] : null)
          if (match) {
            updated[i] = { ...match, relKeyword: kw }
          }
        }
      } catch {}
    }

    setFavorites(updated)
    try { localStorage.setItem('kw-favorites', JSON.stringify(updated)) } catch {}
    setRefreshing(false)
  }

  function toggleFavorite(kw: KeywordData) {
    setFavorites(prev => {
      const exists = prev.some(f => f.relKeyword === kw.relKeyword)
      const next = exists
        ? prev.filter(f => f.relKeyword !== kw.relKeyword)
        : [...prev, kw]
      try { localStorage.setItem('kw-favorites', JSON.stringify(next)) } catch {}
      return next
    })
  }

  function isFavorite(keyword: string) {
    return favorites.some(f => f.relKeyword === keyword)
  }

  function search() {
    const q = input.trim()
    if (!q) return
    setHistory([])
    window.history.pushState({ query: q, appHistory: [] }, '', `?q=${encodeURIComponent(q)}`)
    fetchKeywords(q)
  }

  function drillDown(keyword: string) {
    const newHistory = [...history, searched]
    setHistory(newHistory)
    window.history.pushState({ query: keyword, appHistory: newHistory }, '', `?q=${encodeURIComponent(keyword)}`)
    fetchKeywords(keyword)
  }

  function goBack(index: number) {
    const target = history[index]
    const newHistory = history.slice(0, index)
    setHistory(newHistory)
    window.history.pushState({ query: target, appHistory: newHistory }, '', `?q=${encodeURIComponent(target)}`)
    fetchKeywords(target)
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
    if (sortKey !== 'total') {
      if (sortKey === 'relKeyword') {
        return sortDir === 'asc'
          ? a.relKeyword.localeCompare(b.relKeyword, 'ko')
          : b.relKeyword.localeCompare(a.relKeyword, 'ko')
      }
      let va: number, vb: number
      if (sortKey === 'pc') { va = toNum(a.monthlyPcQcCnt); vb = toNum(b.monthlyPcQcCnt) }
      else { va = toNum(a.monthlyMobileQcCnt); vb = toNum(b.monthlyMobileQcCnt) }
      return sortDir === 'asc' ? va - vb : vb - va
    }

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
      <h1 className="text-2xl font-bold text-gray-800 mb-6">키워드 분석 도구</h1>

      {/* 탭 */}
      <div className="flex gap-1 mb-8 border-b border-gray-200">
        {([
        ['keyword', '🔍 키워드 검색량'],
        ['favorites', `⭐ 관심키워드${favorites.length > 0 ? ` (${favorites.length})` : ''}`],
        ['linkedin', '🎬 링크드인 영상 다운로드'],
        ['youtube', '▶ 유튜브 영상 다운로드'],
        ['vimeo', '🎥 비메오 영상 다운로드'],
      ] as [Tab, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-5 py-2.5 text-sm font-medium rounded-t-lg transition-colors -mb-px border-b-2 ${
              tab === key
                ? 'border-blue-600 text-blue-600 bg-white'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 관심키워드 탭 */}
      {tab === 'favorites' && (
        <div className="max-w-5xl">

          {/* 대량 등록 패널 */}
          <div className="mb-5 border border-gray-200 rounded-xl overflow-hidden">
            <button
              onClick={() => setBulkOpen(o => !o)}
              className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-sm font-medium text-gray-700"
            >
              <span>📋 대량 키워드 등록</span>
              <span className="text-gray-400 text-xs">{bulkOpen ? '▲ 접기' : '▼ 펼치기'}</span>
            </button>
            {bulkOpen && (
              <div className="p-4 bg-white">
                <p className="text-xs text-gray-400 mb-2">키워드를 한 줄에 하나씩 입력하세요. 검색량 데이터를 자동으로 조회합니다.</p>
                <textarea
                  value={bulkInput}
                  onChange={e => setBulkInput(e.target.value)}
                  placeholder={"러닝화\n등산화\n트레킹화\n..."}
                  rows={6}
                  disabled={!!bulkProgress}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y disabled:bg-gray-50"
                />
                <div className="flex items-center justify-between mt-3">
                  {bulkProgress ? (
                    <div className="flex items-center gap-3 text-sm text-gray-500">
                      <svg className="animate-spin h-4 w-4 text-blue-500" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                      </svg>
                      <span>조회 중... {bulkProgress.done} / {bulkProgress.total}</span>
                      <div className="w-40 bg-gray-200 rounded-full h-1.5">
                        <div
                          className="bg-blue-500 h-1.5 rounded-full transition-all"
                          style={{ width: `${(bulkProgress.done / bulkProgress.total) * 100}%` }}
                        />
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400">
                      {bulkInput.split('\n').filter(l => l.trim()).length}개 키워드 입력됨
                    </p>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setBulkOpen(false); setBulkInput('') }}
                      disabled={!!bulkProgress}
                      className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg border border-gray-200 transition-colors disabled:opacity-40"
                    >
                      취소
                    </button>
                    <button
                      onClick={handleBulkAdd}
                      disabled={!bulkInput.trim() || !!bulkProgress}
                      className="text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white px-4 py-1.5 rounded-lg transition-colors font-medium"
                    >
                      등록
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {favorites.length === 0 ? (
            <div className="text-center text-gray-400 py-16">
              <p className="text-4xl mb-3">⭐</p>
              <p className="text-sm">키워드 테이블에서 ☆ 버튼을 누르거나, 위 대량 등록으로 추가해보세요.</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm text-gray-600 flex items-center gap-2">
                  관심 키워드 <span className="font-semibold text-blue-600">{favorites.length}개</span>
                  {(() => {
                    const zeroCount = favorites.filter(f => toNum(f.monthlyPcQcCnt) === 0 && toNum(f.monthlyMobileQcCnt) === 0).length
                    return zeroCount > 0 ? (
                      <button
                        onClick={refreshFavorites}
                        disabled={refreshing}
                        title={`검색량 0인 ${zeroCount}개 키워드 재조회`}
                        className="flex items-center gap-1 text-xs text-orange-500 hover:text-orange-700 disabled:opacity-40 transition-colors border border-orange-300 hover:border-orange-500 px-2 py-0.5 rounded-full"
                      >
                        {refreshing
                          ? <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg>
                          : '🔄'}
                        {refreshing ? '조회 중...' : `0인 키워드 ${zeroCount}개 재조회`}
                      </button>
                    ) : null
                  })()}
                </p>
                <button
                  onClick={() => {
                    const header = '연관키워드,PC 검색량,모바일 검색량,총 검색량,경쟁도'
                    const rows = favorites.map(k => {
                      const total = toNum(k.monthlyPcQcCnt) + toNum(k.monthlyMobileQcCnt)
                      return `${k.relKeyword},${fmt(k.monthlyPcQcCnt)},${fmt(k.monthlyMobileQcCnt)},${total.toLocaleString('ko-KR')},${COMP_LABEL[k.compIdx] ?? k.compIdx}`
                    })
                    const csv = '﻿' + [header, ...rows].join('\n')
                    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url; a.download = '관심키워드.csv'; a.click()
                    URL.revokeObjectURL(url)
                  }}
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
                        <th className="text-left px-4 py-3 text-gray-600 font-medium">연관 키워드</th>
                        <th className="text-right px-4 py-3 text-gray-600 font-medium">PC 검색량</th>
                        <th className="text-right px-4 py-3 text-gray-600 font-medium">모바일 검색량</th>
                        <th className="text-right px-4 py-3 text-gray-600 font-medium">총 검색량</th>
                        <th className="text-center px-4 py-3 text-gray-600 font-medium">경쟁도</th>
                        <th className="w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {favorites.map((k, i) => {
                        const total = toNum(k.monthlyPcQcCnt) + toNum(k.monthlyMobileQcCnt)
                        return (
                          <tr key={k.relKeyword} className="hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-3 text-gray-400">{i + 1}</td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1.5">
                                <button
                                  onClick={() => setTrendKeyword(k.relKeyword)}
                                  className="font-medium text-blue-700 hover:text-blue-900 hover:underline text-left"
                                >
                                  {k.relKeyword}
                                </button>
                                <button
                                  onClick={() => { setTab('keyword'); drillDown(k.relKeyword) }}
                                  title="세부 키워드 조회"
                                  className="text-gray-300 hover:text-blue-500 transition-colors text-xs flex-shrink-0"
                                >
                                  ▶
                                </button>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right text-gray-600">{fmt(k.monthlyPcQcCnt)}</td>
                            <td className="px-4 py-3 text-right text-gray-600">{fmt(k.monthlyMobileQcCnt)}</td>
                            <td className="px-4 py-3 text-right font-semibold text-gray-800">{total.toLocaleString('ko-KR')}</td>
                            <td className="px-4 py-3 text-center">
                              <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${COMP_COLOR[k.compIdx] ?? 'text-gray-600 bg-gray-100'}`}>
                                {COMP_LABEL[k.compIdx] ?? k.compIdx}
                              </span>
                            </td>
                            <td className="px-2 py-3 text-center">
                              <button
                                onClick={() => toggleFavorite(k)}
                                title="관심 키워드 해제"
                                className="text-yellow-400 hover:text-gray-400 transition-colors text-base"
                              >
                                ★
                              </button>
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
        </div>
      )}

      {/* 링크드인 다운로드 탭 */}
      {tab === 'linkedin' && <VideoDownload platform="linkedin" />}

      {/* 유튜브 다운로드 탭 */}
      {tab === 'youtube' && <VideoDownload platform="youtube" />}

      {/* 비메오 다운로드 탭 */}
      {tab === 'vimeo' && <VideoDownload platform="vimeo" />}

      {/* 키워드 검색 탭 */}
      {tab === 'keyword' && <>

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
          {/* 자동완성 연관검색어 */}
          {suggestions.length > 0 && (
            <div className="mb-4">
              <p className="text-xs text-gray-400 mb-2">자동완성 연관검색어</p>
              <div className="flex flex-wrap gap-2">
                {suggestions.map(s => (
                  <button
                    key={s}
                    onClick={() => drillDown(s)}
                    className="text-sm bg-blue-50 text-blue-700 border border-blue-200 rounded-full px-3 py-1 hover:bg-blue-100 transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 브레드크럼 내비게이션 */}
          {history.length > 0 && (
            <div className="flex items-center gap-1 flex-wrap mb-3 text-sm">
              {history.map((h, i) => (
                <span key={i} className="flex items-center gap-1">
                  <button
                    onClick={() => goBack(i)}
                    className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
                  >
                    {h}
                  </button>
                  <span className="text-gray-400">›</span>
                </span>
              ))}
              <span className="text-gray-700 font-semibold">{searched}</span>
            </div>
          )}

          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-gray-600 flex items-center gap-2 flex-wrap">
              <span>
                <span className="font-semibold text-gray-800">"{searched}"</span> 연관 키워드{' '}
                <span className="font-semibold text-blue-600">{sorted.length}개</span>
              </span>
              {(sortKey !== 'total' || sortDir !== 'desc') && (
                <button
                  onClick={() => { setSortKey('total'); setSortDir('desc') }}
                  className="text-xs text-orange-600 hover:text-orange-800 border border-orange-300 hover:border-orange-500 px-2 py-0.5 rounded-full transition-colors"
                >
                  ↺ 기본 정렬로 복원
                </button>
              )}
              <span className="text-xs text-gray-400">키워드 클릭 → 트렌드 · ▶ 클릭 → 세부 키워드 조회</span>
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
                    <th className="w-10 text-center px-2 py-3 text-gray-600 font-medium">⭐</th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {sorted.map((k, i) => {
                    const total = toNum(k.monthlyPcQcCnt) + toNum(k.monthlyMobileQcCnt)
                    const fav = isFavorite(k.relKeyword)
                    return (
                      <tr key={k.relKeyword} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 text-gray-400">{i + 1}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => setTrendKeyword(k.relKeyword)}
                              className="font-medium text-blue-700 hover:text-blue-900 hover:underline text-left"
                            >
                              {k.relKeyword}
                            </button>
                            <button
                              onClick={() => drillDown(k.relKeyword)}
                              title="세부 키워드 조회"
                              className="text-gray-300 hover:text-blue-500 transition-colors text-xs flex-shrink-0"
                            >
                              ▶
                            </button>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right text-gray-600">{fmt(k.monthlyPcQcCnt)}</td>
                        <td className="px-4 py-3 text-right text-gray-600">{fmt(k.monthlyMobileQcCnt)}</td>
                        <td className="px-4 py-3 text-right font-semibold text-gray-800">{total.toLocaleString('ko-KR')}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${COMP_COLOR[k.compIdx] ?? 'text-gray-600 bg-gray-100'}`}>
                            {COMP_LABEL[k.compIdx] ?? k.compIdx}
                          </span>
                        </td>
                        <td className="px-2 py-3 text-center">
                          <button
                            onClick={() => toggleFavorite(k)}
                            title={fav ? '관심 키워드 해제' : '관심 키워드 추가'}
                            className={`text-base transition-colors ${fav ? 'text-yellow-400 hover:text-gray-400' : 'text-gray-300 hover:text-yellow-400'}`}
                          >
                            {fav ? '★' : '☆'}
                          </button>
                        </td>
                        <td className="px-2 py-3 text-center">
                          <button
                            onClick={() => setTrendKeyword(k.relKeyword)}
                            title="트렌드 보기"
                            className="text-gray-400 hover:text-blue-600 transition-colors text-base"
                          >
                            📈
                          </button>
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

      </> /* 키워드 탭 끝 */}
    </main>
  )
}
