import { NextRequest, NextResponse } from 'next/server'
import { spawn } from 'child_process'
import { tmpdir } from 'os'
import { join } from 'path'
import { readFile, unlink, readdir } from 'fs/promises'
import { randomUUID } from 'crypto'

export const runtime = 'nodejs'
export const maxDuration = 120

function runYtDlp(args: string[]): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const proc = spawn('python', ['-m', 'yt_dlp', ...args])
    let stdout = ''
    let stderr = ''
    proc.stdout.on('data', (d: Buffer) => { stdout += d.toString() })
    proc.stderr.on('data', (d: Buffer) => { stderr += d.toString() })
    proc.on('close', code => {
      if (code === 0) resolve({ stdout, stderr })
      else reject(new Error(stderr || stdout || `exit code ${code}`))
    })
    proc.on('error', reject)
  })
}

export async function POST(req: NextRequest) {
  const { url } = await req.json()
  const isLinkedIn = url?.includes('linkedin.com')
  const isYouTube = url?.includes('youtube.com') || url?.includes('youtu.be')
  const isVimeo = url?.includes('vimeo.com')
  if (!url || (!isLinkedIn && !isYouTube && !isVimeo)) {
    return NextResponse.json({ error: '유효한 LinkedIn, YouTube 또는 Vimeo URL을 입력해주세요.' }, { status: 400 })
  }

  const id = randomUUID()
  const outTemplate = join(tmpdir(), `${id}.%(ext)s`)

  try {
    // 영상 정보 먼저 조회
    const { stdout: infoJson } = await runYtDlp([
      '--dump-json', '--no-playlist', url,
    ])
    const info = JSON.parse(infoJson.trim().split('\n')[0])
    const title: string = info.title ?? '영상'
    const ext: string = info.ext ?? 'mp4'

    // 다운로드
    await runYtDlp([
      '-o', outTemplate,
      '--no-playlist',
      '--merge-output-format', 'mp4',
      url,
    ])

    // 저장된 파일 찾기
    const tmp = tmpdir()
    const files = await readdir(tmp)
    const file = files.find(f => f.startsWith(id))
    if (!file) throw new Error('다운로드된 파일을 찾을 수 없습니다.')

    const filePath = join(tmp, file)
    const buffer = await readFile(filePath)
    await unlink(filePath).catch(() => {})

    const safeName = title.replace(/[^\w\s가-힣]/g, '').trim().slice(0, 60) || '영상'

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(safeName)}.${ext}`,
        'Content-Length': buffer.length.toString(),
      },
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '다운로드 실패'
    const isPrivate = msg.includes('login') || msg.includes('private') || msg.includes('sign in')
    return NextResponse.json(
      { error: isPrivate ? '비공개 영상이거나 로그인이 필요합니다.' : `다운로드 실패: ${msg.slice(0, 200)}` },
      { status: 500 }
    )
  }
}
