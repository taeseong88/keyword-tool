# 영상 다운로드 실행 파일

Windows에서는 이 폴더의 `yt-dlp.exe`를 사용하므로 Python 설치가 필요하지 않습니다.
공식 배포 파일: https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe

다른 PC로 옮길 때도 실행 파일을 이 폴더에 넣어주세요. 실행 파일은 Git에 포함하지 않습니다.
다른 위치의 실행 파일은 `.env.local`의 `YT_DLP_PATH`에 절대 경로로 지정할 수 있습니다.
Windows 이외의 환경에서는 PATH에 설치된 `yt-dlp`를 사용합니다.

업데이트는 프로젝트 폴더에서 `tools\yt-dlp.exe -U`로 실행할 수 있습니다.
