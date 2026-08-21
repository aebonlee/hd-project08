/**
 * sample-data.js — 데모용 샘플 데이터
 * templates/marketing_sample.xlsx 와 동일한 내용을 임베드한 것.
 * (make_samples.py 가 이 데이터와 같은 값으로 엑셀 양식/샘플을 생성한다)
 */
(function (root, factory) {
  var data = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = data;
  }
  if (root) {
    root.MarketingSampleData = data;
  }
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  return {
    members: ['홍재영', '김민서', '이준호', '박소연', '최다인'],

    campaigns: [
      { id: 'C1', name: 'Hyundai 굴착기 신모델 런칭', brand: 'Hyundai', status: '진행', progress: 65, owner: '홍재영', start: '2026-07-01', end: '2026-09-30', milestone: '티저 영상 공개 (08-28)' },
      { id: 'C2', name: 'Develon 가을 프로모션', brand: 'Develon', status: '기획', progress: 20, owner: '김민서', start: '2026-08-10', end: '2026-10-31', milestone: '프로모션 기획안 확정 (08-26)' },
      { id: 'C3', name: 'bauma 2026 전시회 준비', brand: '공통', status: '진행', progress: 45, owner: '이준호', start: '2026-06-01', end: '2026-11-15', milestone: '부스 시안 확정 (09-04)' },
      { id: 'C4', name: '뉴스레터 리뉴얼', brand: '공통', status: '검토', progress: 80, owner: '박소연', start: '2026-07-15', end: '2026-08-31', milestone: '최종 검토 회의 (08-25)' },
      { id: 'C5', name: 'SNS 브랜드 필름 시리즈', brand: 'Hyundai', status: '보류', progress: 30, owner: '최다인', start: '2026-06-15', end: '2026-12-31', milestone: '2차 촬영 일정 재협의' },
      { id: 'C6', name: '홈페이지 제품 페이지 개편', brand: 'Develon', status: '완료', progress: 100, owner: '김민서', start: '2026-05-01', end: '2026-07-31', milestone: '-' }
    ],

    tasks: [
      { id: 'T1', name: '런칭 티저 영상 시안 검토', campaign: 'Hyundai 굴착기 신모델 런칭', owner: '홍재영', priority: '높음', due: '2026-08-21', status: '진행' },
      { id: 'T2', name: '보도자료 초안 작성', campaign: 'Hyundai 굴착기 신모델 런칭', owner: '박소연', priority: '중간', due: '2026-08-19', status: '진행' },
      { id: 'T3', name: '프로모션 경품 견적 비교', campaign: 'Develon 가을 프로모션', owner: '김민서', priority: '중간', due: '2026-08-25', status: '대기' },
      { id: 'T4', name: '딜러 대상 안내 메일 발송', campaign: 'Develon 가을 프로모션', owner: '김민서', priority: '높음', due: '2026-08-14', status: '대기' },
      { id: 'T5', name: '부스 조감도 1차 피드백 정리', campaign: 'bauma 2026 전시회 준비', owner: '이준호', priority: '높음', due: '2026-08-20', status: '완료' },
      { id: 'T6', name: '전시 운영 인력 견적 요청', campaign: 'bauma 2026 전시회 준비', owner: '이준호', priority: '낮음', due: '2026-08-28', status: '대기' },
      { id: 'T7', name: '뉴스레터 신규 템플릿 QA', campaign: '뉴스레터 리뉴얼', owner: '박소연', priority: '높음', due: '2026-08-24', status: '진행' },
      { id: 'T8', name: '구독자 세그먼트 재정리', campaign: '뉴스레터 리뉴얼', owner: '최다인', priority: '중간', due: '2026-08-12', status: '완료' },
      { id: 'T9', name: '브랜드 필름 2차 콘티 보완', campaign: 'SNS 브랜드 필름 시리즈', owner: '최다인', priority: '낮음', due: '2026-09-11', status: '대기' },
      { id: 'T10', name: '8월 SNS 콘텐츠 캘린더 확정', campaign: '(캠페인 외 공통)', owner: '최다인', priority: '높음', due: '2026-08-18', status: '완료' },
      { id: 'T11', name: '월간 채널 리포트 작성', campaign: '(캠페인 외 공통)', owner: '홍재영', priority: '중간', due: '2026-08-31', status: '대기' },
      { id: 'T12', name: '개편 페이지 성과 회고 공유', campaign: '홈페이지 제품 페이지 개편', owner: '김민서', priority: '낮음', due: '2026-08-07', status: '완료' }
    ],

    events: [
      { id: 'E1', date: '2026-08-17', time: '10:00', type: '회의', title: '주간 파트 회의' },
      { id: 'E2', date: '2026-08-18', time: '14:00', type: '회의', title: '런칭 캠페인 대행사 미팅' },
      { id: 'E3', date: '2026-08-19', time: '', type: '마감', title: '보도자료 초안 마감' },
      { id: 'E4', date: '2026-08-20', time: '11:00', type: '회의', title: '뉴스레터 리뉴얼 중간 점검' },
      { id: 'E5', date: '2026-08-21', time: '', type: '마감', title: '티저 영상 시안 검토 마감' },
      { id: 'E6', date: '2026-08-21', time: '16:00', type: '행사', title: '사내 신제품 쇼케이스 리허설' },
      { id: 'E7', date: '2026-08-24', time: '10:00', type: '회의', title: '주간 파트 회의' },
      { id: 'E8', date: '2026-08-25', time: '15:00', type: '회의', title: '뉴스레터 리뉴얼 최종 검토' },
      { id: 'E9', date: '2026-08-26', time: '', type: '마감', title: 'Develon 프로모션 기획안 확정' },
      { id: 'E10', date: '2026-08-28', time: '09:00', type: '행사', title: '신모델 티저 영상 공개' }
    ],

    // 채널 실적: 월(YYYY-MM) × 채널 × 대표 지표 값
    channelMeta: [
      { channel: '뉴스레터', metric: '오픈율', unit: '%' },
      { channel: '홈페이지', metric: '방문자 수', unit: '명' },
      { channel: 'SNS', metric: '팔로워 순증', unit: '명' },
      { channel: '전시회/행사', metric: '신규 리드', unit: '건' }
    ],
    channelStats: [
      { month: '2026-03', channel: '뉴스레터', value: 31.2 },
      { month: '2026-04', channel: '뉴스레터', value: 33.5 },
      { month: '2026-05', channel: '뉴스레터', value: 30.8 },
      { month: '2026-06', channel: '뉴스레터', value: 35.1 },
      { month: '2026-07', channel: '뉴스레터', value: 37.4 },
      { month: '2026-08', channel: '뉴스레터', value: 39.0 },
      { month: '2026-03', channel: '홈페이지', value: 41200 },
      { month: '2026-04', channel: '홈페이지', value: 43800 },
      { month: '2026-05', channel: '홈페이지', value: 40100 },
      { month: '2026-06', channel: '홈페이지', value: 45600 },
      { month: '2026-07', channel: '홈페이지', value: 50200 },
      { month: '2026-08', channel: '홈페이지', value: 47900 },
      { month: '2026-03', channel: 'SNS', value: 820 },
      { month: '2026-04', channel: 'SNS', value: 960 },
      { month: '2026-05', channel: 'SNS', value: 1120 },
      { month: '2026-06', channel: 'SNS', value: 1050 },
      { month: '2026-07', channel: 'SNS', value: 1340 },
      { month: '2026-08', channel: 'SNS', value: 1490 },
      { month: '2026-03', channel: '전시회/행사', value: 0 },
      { month: '2026-04', channel: '전시회/행사', value: 65 },
      { month: '2026-05', channel: '전시회/행사', value: 18 },
      { month: '2026-06', channel: '전시회/행사', value: 42 },
      { month: '2026-07', channel: '전시회/행사', value: 12 },
      { month: '2026-08', channel: '전시회/행사', value: 28 }
    ],

    notices: [
      { id: 'N1', pinned: true, importance: '높음', title: '[필독] 9월 조직개편에 따른 결재라인 변경 안내', author: '홍재영', date: '2026-08-18' },
      { id: 'N2', pinned: false, importance: '보통', title: '8월 4주차 주간회의는 월요일 10시 회의실 B', author: '홍재영', date: '2026-08-20' },
      { id: 'N3', pinned: false, importance: '높음', title: '브랜드 로고 신규 가이드 v2.1 적용 요청 (기존 파일 사용 금지)', author: '이준호', date: '2026-08-14' },
      { id: 'N4', pinned: false, importance: '보통', title: '전시회 출장 정산 서류 8/29까지 제출', author: '박소연', date: '2026-08-11' }
    ]
  };
});
