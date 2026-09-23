import { access, chmod, mkdir, readFile, rename, rm, writeFile } from 'fs/promises'
import { constants } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { createHash, randomUUID } from 'crypto'

// 버전을 고정하고 같은 릴리스의 체크섬으로 검증한 뒤 실행한다.
const VERSION = '2026.08.19'
let pending: Promise<string> | undefined

function assetName(): string {
  if (process.platform === 'win32') {
    if (process.arch === 'x64') return 'yt-dlp.exe'
    if (process.arch === 'arm64') return 'yt-dlp_arm64.exe'
  }
  if (process.platform === 'linux') {
    if (process.arch === 'x64') return 'yt-dlp_linux'
    if (process.arch === 'arm64') return 'yt-dlp_linux_aarch64'
  }
  if (process.platform === 'darwin') return 'yt-dlp_macos'
  throw new Error('현재 서버 환경에서는 영상 다운로드를 지원하지 않습니다.')
}

async function prepareDownloader(): Promise<string> {
  if (process.env.YT_DLP_PATH) {
    await access(process.env.YT_DLP_PATH, constants.X_OK)
    return process.env.YT_DLP_PATH
  }

  const asset = assetName()
  // 읽기 전용 배포 환경에서도 쓸 수 있는 임시 디렉터리에 보관한다.
  const directory = join(tmpdir(), 'keyword-tool-yt-dlp', VERSION)
  const executable = join(directory, asset)
  const checksumPath = `${executable}.sha256`
  try {
    const [binary, expected] = await Promise.all([readFile(executable), readFile(checksumPath, 'utf8')])
    if (createHash('sha256').update(binary).digest('hex') === expected.trim()) {
      await access(executable, constants.X_OK)
      return executable
    }
  } catch {
    // 캐시가 없거나 불완전하면 다시 준비한다.
  }

  const base = `https://github.com/yt-dlp/yt-dlp/releases/download/${VERSION}`
  const [binaryResponse, checksumResponse] = await Promise.all([
    fetch(`${base}/${asset}`, { signal: AbortSignal.timeout(60_000) }),
    fetch(`${base}/SHA2-256SUMS`, { signal: AbortSignal.timeout(60_000) }),
  ])
  if (!binaryResponse.ok || !checksumResponse.ok) {
    throw new Error('영상 다운로드 도구를 준비하지 못했습니다. 잠시 후 다시 시도해주세요.')
  }
  const binary = Buffer.from(await binaryResponse.arrayBuffer())
  const checksums = await checksumResponse.text()
  const expected = checksums.split('\n')
    .map(line => line.trim().split(/\s+/))
    .find(([, name]) => name === asset)?.[0]
  if (!expected || createHash('sha256').update(binary).digest('hex') !== expected) {
    throw new Error('영상 다운로드 도구의 무결성 검증에 실패했습니다.')
  }

  await mkdir(directory, { recursive: true })
  const staging = `${executable}.${randomUUID()}.tmp`
  try {
    await writeFile(staging, binary, { mode: 0o755 })
    await chmod(staging, 0o755)
    await rename(staging, executable)
    await writeFile(checksumPath, expected)
  } finally {
    await rm(staging, { force: true })
  }
  return executable
}

export function ensureDownloader(): Promise<string> {
  if (!pending) {
    pending = prepareDownloader().catch(error => {
      pending = undefined
      throw error
    })
  }
  return pending
}
