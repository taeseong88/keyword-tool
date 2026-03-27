'use client'

import { useEffect, useState } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'

interface TrendPoint {
  period: string
  ratio: number
}

interface Props {
  keyword: string
  onClose: () => void
}

export default function TrendModal({ keyword, onClose }: Props) {
  const [data, setData] = useState<TrendPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch(`/api/trend?keyword=${encodeURIComponent(keyword)}`)
      .then(r => r.json())
      .then(json => {
        if (json.error) { setError(json.error); return }
        const points: TrendPoint[] = json.results?.[0]?.data ?? []
        setData(points.map(p => ({ ...p, period: p.period.slice(0, 7) })))
      })
      .catch(() => setError('데이터를 불러오지 못했습니다.'))
      .finally(() => setLoading(false))
  }, [keyword])

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-bold text-gray-800">검색 트렌드</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              <span className="font-medium text-blue-600">"{keyword}"</span> · 최근 12개월 (네이버 기준, 최대값=100)
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>

        {loading && (
          <div className="flex items-center justify-center h-48 text-gray-400">불러오는 중...</div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
        )}

        {!loading && !error && data.length > 0 && (
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="period" tick={{ fontSize: 11, fill: '#9ca3af' }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#9ca3af' }} />
              <Tooltip
                formatter={(v: number) => [`${v}`, '검색 지수']}
                labelFormatter={l => `${l}`}
                contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
              />
              <Line
                type="monotone"
                dataKey="ratio"
                stroke="#2563eb"
                strokeWidth={2.5}
                dot={{ r: 3, fill: '#2563eb' }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}

        {!loading && !error && data.length === 0 && (
          <div className="flex items-center justify-center h-48 text-gray-400 text-sm">트렌드 데이터가 없습니다.</div>
        )}
      </div>
    </div>
  )
}
