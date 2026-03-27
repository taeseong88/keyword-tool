import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '키워드 검색량 분석',
  description: '네이버 키워드 검색량 및 연관 키워드 분석 도구',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="bg-gray-50 min-h-screen">{children}</body>
    </html>
  )
}
