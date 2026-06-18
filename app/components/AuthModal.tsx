'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'

interface Props {
  onClose: () => void
  onSuccess: () => void
}

type Mode = 'login' | 'register'

export default function AuthModal({ onClose, onSuccess }: Props) {
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    if (mode === 'register') {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? '회원가입 실패')
        setLoading(false)
        return
      }
    }

    const result = await signIn('credentials', {
      email,
      password,
      redirect: false,
    })

    setLoading(false)
    if (result?.error) {
      setError('이메일 또는 비밀번호가 올바르지 않습니다.')
    } else {
      onSuccess()
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-xl leading-none"
        >
          ×
        </button>

        <h2 className="text-lg font-bold text-gray-800 mb-1">
          {mode === 'login' ? '로그인' : '회원가입'}
        </h2>
        <p className="text-sm text-gray-500 mb-5">
          {mode === 'login'
            ? '관심키워드를 기기 간 동기화할 수 있습니다.'
            : '이메일과 비밀번호로 계정을 만드세요.'}
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="이메일"
            required
            className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder={mode === 'register' ? '비밀번호 (6자 이상)' : '비밀번호'}
            required
            minLength={mode === 'register' ? 6 : 1}
            className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          {error && (
            <p className="text-red-500 text-xs">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white py-2.5 rounded-lg text-sm font-medium transition-colors"
          >
            {loading ? '처리 중...' : mode === 'login' ? '로그인' : '가입하기'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-4">
          {mode === 'login' ? '계정이 없으신가요?' : '이미 계정이 있으신가요?'}{' '}
          <button
            onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError('') }}
            className="text-blue-600 hover:underline font-medium"
          >
            {mode === 'login' ? '회원가입' : '로그인'}
          </button>
        </p>
      </div>
    </div>
  )
}
