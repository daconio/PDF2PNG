# ParsePDF

**ParsePDF**는 클라이언트 사이드(브라우저)에서만 작동하는 개인정보 보호 중심의 PDF 도구입니다. 서버로 파일을 전송하지 않고 브라우저 내에서 PDF 변환, 병합, 분할 작업을 수행합니다.

## 주요 기능

*   **PDF to Image**: PDF 페이지를 고해상도 PNG/JPG로 변환
*   **Image to PDF**: 여러 이미지를 하나의 PDF로 병합
*   **Merge PDF**: 여러 PDF 파일을 하나로 합치기
*   **Flatten PDF**: PDF를 이미지로 변환 후 다시 병합 (편집 방지)
*   **Split PDF**: PDF 페이지 분할
*   **Image Editor**: 자르기, 그리기, 텍스트 추가 등 간단한 편집 기능 내장

## 기술 스택

*   React 18 + Vite
*   TypeScript
*   Tailwind CSS (Neo-Brutalism Design)
*   pdfjs-dist / jspdf / pdf-lib

## 로컬 실행 방법

```bash
# 의존성 설치
npm install

# 개발 서버 실행
npm run dev
```

## 배포

이 프로젝트는 [Vercel](https://vercel.com)에 최적화되어 있습니다.
