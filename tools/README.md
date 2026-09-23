# 영상 다운로드 실행 파일

첫 다운로드 요청 때 서버 운영체제에 맞는 공식 yt-dlp 독립 실행 파일을 자동으로 준비합니다.
Python 설치나 `tools/yt-dlp.exe`의 수동 복사는 필요하지 않습니다.

버전은 `app/lib/downloader.ts`에 고정되어 있으며 공식 릴리스의 SHA256 체크섬을 검증합니다.
실행 파일은 서버 임시 디렉터리에 캐시하므로 읽기 전용 배포 환경에서도 프로젝트 폴더에 쓰지 않습니다.
Windows 및 Linux의 x64/arm64, macOS를 지원합니다. Linux 실행 파일은 glibc 환경을 필요로 합니다.
서버에서 GitHub 릴리스 다운로드 및 임시 디렉터리의 실행 파일 실행을 허용해야 합니다.

관리자가 직접 준비한 실행 파일은 환경 변수 `YT_DLP_PATH`에 절대 경로로 지정할 수 있습니다.
공식 배포: https://github.com/yt-dlp/yt-dlp/releases
