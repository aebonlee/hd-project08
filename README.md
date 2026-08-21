# hd-project08 — AMPS기획팀 업무 도구 4종

> 🌐 **배포 페이지: [https://aebonlee.github.io/hd-project08/](https://aebonlee.github.io/hd-project08/)** · 저장소: https://github.com/aebonlee/hd-project08

HD건설기계 AMPS기획팀(기획: 홍재영)의 업무 도구 모음 — 생성형 AI 업무자동화 전문가과정 1차수 프로젝트 (1차 개발본, 이후 개별 개발용).

| 도구 | 폴더 | 설명 |
|---|---|---|
| 뉴스레터 결과보고 대시보드 | `dashboard_newsletter/` | 현대·디벨론 브랜드 테마, 엑셀 업로드 자동 반영, 세계지도 오픈율, AI 자동 결과 분석 |
| 마케팅 업무공유 대시보드 | `dashboard_marketing/` | 캠페인 보드·담당자별 업무·주간 일정·채널 성과·공지 |
| 부품 사진 파일명 자동화 | `photo_renamer/` | 사진 속 품번·브랜드 판독 → `연번_품번_(브랜드)` 일괄 변경 (무료 OCR + Claude/ChatGPT/Solar 선택) |
| 회의록 정리 도우미 | `meeting_notes/` | 메모 → 결정/논의/액션 자동 분류 → 표준 회의록 |

각 폴더의 README에 사용법·데이터 양식·이어서 개발하는 방법이 정리되어 있습니다. 기획서 원문은 [CLAUDE.md](CLAUDE.md), 개발 과정은 [docs/개발일지.md](docs/개발일지.md) 참조.

도구별 바로가기: [뉴스레터 대시보드](https://aebonlee.github.io/hd-project08/dashboard_newsletter/) · [마케팅 대시보드](https://aebonlee.github.io/hd-project08/dashboard_marketing/) · [부품 사진 자동화](https://aebonlee.github.io/hd-project08/photo_renamer/) · [회의록 도우미](https://aebonlee.github.io/hd-project08/meeting_notes/)

## 실행

- 배포 페이지 접속(권장) 또는 저장소를 받아 `python3 -m http.server` 후 접속
- 테스트: 각 폴더에서 `node test/*.test.js`
