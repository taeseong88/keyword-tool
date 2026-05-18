'use client'

import { useEffect, useState } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'

interface MergedPoint {
  period: string
  naver: number | null
  googleWeb: number | null
  youtube: number | null
}

interface Props {
  keyword: string
  onClose: () => void
}

const LINES = [
  { key: 'naver', label: '네이버', color: '#2563eb' },
  { key: 'googleWeb', label: '구글 웹', color: '#f97316' },
  { key: 'youtube', label: '유튜브', color: '#dc2626' },
] as const

export default function TrendModal({ keyword, onClose }: Props) {
  const [data, setData] = useState<MergedPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [errors, setErrors] = useState<string[]>([])

  useEffect(() => {
    setLoading(true)
    setErrors([])
    setData([])

    const naverP = fetch(`/api/trend?keyword=${encodeURIComponent(keyword)}`).then(r => r.json())

    // 구글 트렌드: 실패해도 전체를 막지 않음
    const googleP = fetch(`/api/google-trends?keyword=${encodeURIComponent(keyword)}`).then(r => r.json()).catch(() => ({ error: 'fetch 실패' }))

    Promise.allSettled([naverP, googleP]).then(([naverResult, googleResult]) => {
      const naverJson = naverResult.status === 'fulfilled' ? naverResult.value : { error: '네이버 오류' }
      const googleJson = googleResult.status === 'fulfilled' ? googleResult.value : { error: 'fetch 실패' }
      const errs: string[] = []

      // 네이버 데이터 (실패 시 에러 표시)
      const naverMap = new Map<string, number>()
      if (naverJson.error) {
        errs.push(`네이버: ${naverJson.error}`)
      } else {
        const points: { period: string; ratio: number }[] = naverJson.results?.[0]?.data ?? []
        for (const p of points) {
          naverMap.set(p.period.slice(0, 7), p.ratio)
        }
      }

      // 구글 트렌드 데이터 (차단 시 조용히 스킵)
      const webMap = new Map<string, number>()
      const ytMap = new Map<string, number>()
      if (!googleJson.error) {
        for (const p of googleJson.web ?? []) webMap.set(p.period, p.value)
        for (const p of googleJson.youtube ?? []) ytMap.set(p.period, p.value)
      }

      // 전체 기간 합집합
      const allPeriods = Array.from(
        new Set([...naverMap.keys(), ...webMap.keys(), ...ytMap.keys()])
      ).sort()

      const merged: MergedPoint[] = allPeriods.map(period => ({
        period,
        naver: naverMap.get(period) ?? null,
        googleWeb: webMap.get(period) ?? null,
        youtube: ytMap.get(period) ?? null,
      }))

      setData(merged)
      setErrors(errs)
    }).catch(() => {
      setErrors(['데이터를 불러오지 못했습니다.'])
    }).finally(() => setLoading(false))
  }, [keyword])

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-bold text-gray-800">검색 트렌드</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              <span className="font-medium text-blue-600">"{keyword}"</span> · 최근 12개월 · 상대적 관심도 (최대=100)
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>

        {errors.length > 0 && (
          <div className="mb-4 space-y-1">
            {errors.map((e, i) => (
              <div key={i} className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-3 py-2 rounded-lg text-xs">
                ⚠ {e}
              </div>
            ))}
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center h-48 text-gray-400">불러오는 중...</div>
        )}

        {!loading && data.length > 0 && (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="period" tick={{ fontSize: 10, fill: '#9ca3af' }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#9ca3af' }} />
              <Tooltip
                formatter={(v, name) => {
                  const label = LINES.find(l => l.key === name)?.label ?? name
                  return [`${v}`, label]
                }}
                contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
              />
              <Legend
                formatter={name => LINES.find(l => l.key === name)?.label ?? name}
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: 12 }}
              />
              {LINES.map(({ key, color }) => (
                <Line
                  key={key}
                  type="monotone"
                  dataKey={key}
                  stroke={color}
                  strokeWidth={2}
                  dot={{ r: 3, fill: color }}
                  activeDot={{ r: 5 }}
                  connectNulls
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}

        {!loading && data.length === 0 && errors.length === 0 && (
          <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
            트렌드 데이터가 없습니다.
          </div>
        )}
      </div>
    </div>
  )
}
