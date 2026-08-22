# hd-project08 — 마케팅 업무공유 대시보드 + 회의록 정리 도우미

> 🌐 **배포 페이지: [https://aebonlee.github.io/hd-project08/](https://aebonlee.github.io/hd-project08/)** · 저장소: https://github.com/aebonlee/hd-project08

HD건설기계 AMPS기획팀(기획: 홍재영)의 업무 도구 — 생성형 AI 업무자동화 전문가과정 1차수 프로젝트 (1차 개발본, 이후 개별 개발용).

요청하신 3가지는 저장소를 나눠 관리합니다:

| 저장소 | 도구 |
|---|---|
| **hd-project08 (이곳)** | ① 마케팅 파트 업무공유 대시보드 (`dashboard_marketing/`) + 보너스: 회의록 정리 도우미 (`meeting_notes/`) |
| [hd-project09](https://github.com/aebonlee/hd-project09) | ② 뉴스레터 결과보고 대시보드 |
| [hd-project10](https://github.com/aebonlee/hd-project10) | ③ 부품 사진 파일명 자동화 |

각 폴더의 README에 사용법·데이터 양식·이어서 개발하는 방법이 정리되어 있습니다. 기획서 원문은 [CLAUDE.md](CLAUDE.md), 개발 과정은 [docs/개발일지.md](docs/개발일지.md) 참조.

## 실행/테스트

- 배포 페이지 접속 또는 `python3 -m http.server` 후 접속
- `node dashboard_marketing/test/logic.test.js` · `node meeting_notes/test/logic.test.js`
