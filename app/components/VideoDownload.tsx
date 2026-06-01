'use client'

import { useState } from 'react'

type Status = 'idle' | 'loading' | 'done' | 'error'

interface Props {
  platform: 'linkedin' | 'youtube'
}

const CONFIG = {
  linkedin: {
    placeholder: 'https://www.linkedin.com/posts/...',
    description: 'LinkedIn 공개 영상 URL을 붙여넣으면 MP4로 다운로드합니다.',
    note: '* 공개 게시물 영상만 지원 · 비공개 / 로그인 필요 영상은 다운로드 불가',
  },
  youtube: {
    placeholder: 'https://www.youtube.com/watch?v=... 또는 https://youtu.be/...',
    description: 'YouTube 영상 URL을 붙여넣으면 MP4로 다운로드합니다.',
    note: '* 공개 영상만 지원 · 연령 제한 / 멤버십 전용 영상은 다운로드 불가',
  },
}

export default function VideoDownload({ platform }: Props) {
  const [url, setUrl] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [message, setMessage] = useState('')
  const cfg = CONFIG[platform]

  async function handleDownload() {
    const trimmed = url.trim()
    if (!trimmed) return
    setStatus('loading')
    setMessage('')

    try {
      const res = await fetch('/api/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: trimmed }),
      })

      if (!res.ok) {
        const data = await res.json()
        setStatus('error')
        setMessage(data.error ?? '다운로드 실패')
        return
      }

      const disposition = res.headers.get('Content-Disposition') ?? ''
      const match = disposition.match(/filename\*=UTF-8''(.+)/)
      const filename = match ? decodeURIComponent(match[1]) : 'video.mp4'

      const blob = await res.blob()
      const objUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = objUrl
      a.download = filename
      a.click()
      URL.revokeObjectURL(objUrl)

      setStatus('done')
      setMessage(`"${filename}" 다운로드 완료`)
    } catch {
      setStatus('error')
      setMessage('네트워크 오류가 발생했습니다.')
    }
  }

  return (
    <div className="max-w-2xl">
      <p className="text-gray-500 text-sm mb-4">{cfg.description}</p>

      <div className="flex gap-2">
        <input
          type="url"
          value={url}
          onChange={e => { setUrl(e.target.value); setStatus('idle'); setMessage('') }}
          onKeyDown={e => e.key === 'Enter' && handleDownload()}
          placeholder={cfg.placeholder}
          className="flex-1 border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          disabled={status === 'loading'}
        />
        <button
          onClick={handleDownload}
          disabled={!url.trim() || status === 'loading'}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white px-5 py-3 rounded-lg font-medium transition-colors text-sm whitespace-nowrap"
        >
          {status === 'loading' ? '다운로드 중...' : '다운로드'}
        </button>
      </div>

      {status === 'loading' && (
        <div className="mt-4 flex items-center gap-2 text-sm text-gray-500">
          <svg className="animate-spin h-4 w-4 text-blue-500" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
          </svg>
          영상을 분석하고 다운로드하는 중입니다... (최대 1~2분 소요)
        </div>
      )}

      {status === 'done' && (
        <div className="mt-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
          ✅ {message}
        </div>
      )}

      {status === 'error' && (
        <div className="mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          ❌ {message}
        </div>
      )}

      <p className="mt-4 text-xs text-gray-400">{cfg.note}</p>
    </div>
  )
}
