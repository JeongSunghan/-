insert into public.providers (
  id,
  name,
  official_status,
  contact_status,
  base_area,
  mobile_service,
  truck_label,
  service_tags,
  service_areas,
  price_hints,
  intro
)
values
  (
    '11111111-1111-4111-8111-111111111111',
    '칼의부활 수원트럭',
    'discovered',
    'queued',
    '수원 장안구',
    true,
    '1t 이동형 작업 트럭',
    array['식칼', '가위', '나이프', '식당용'],
    array['장안구', '권선구', '팔달구'],
    array['식칼 8,000원~', '가위 7,000원~'],
    '시장 출점과 주거지 방문을 병행하는 형태. 초기 지도를 채우는 bootstrap provider입니다.'
  ),
  (
    '22222222-2222-4222-8222-222222222222',
    '신의칼 출장연마',
    'pending',
    'contacted',
    '수원 영통구',
    true,
    '승합차 이동형 장비',
    array['세라믹', '일식 나이프', '가위'],
    array['영통구', '팔달구', '용인'],
    array['세라믹 18,000원~', '나이프 15,000원~'],
    '특수 재질과 고급 나이프 작업에 특화. official registry로 전환될 후보입니다.'
  ),
  (
    '33333333-3333-4333-8333-333333333333',
    '대장장이 칼갈이',
    'discovered',
    'queued',
    '수원 권선구',
    true,
    '시장 순회형 트럭',
    array['식칼', '가위', '정육점 칼'],
    array['권선구', '팔달구', '성남', '화성'],
    array['정육점 칼 별도 협의', '출장비 0원~10,000원'],
    '시장과 상권 순회 일정이 많고, 성남 방향 확장 후보로도 보는 provider입니다.'
  )
on conflict (id) do nothing;

insert into public.reports (
  id,
  provider_id,
  district,
  neighborhood,
  place,
  truck_type,
  provider_hint,
  note,
  reporter_alias,
  lat,
  lng,
  has_photo,
  trust_score,
  status,
  source_type,
  reported_at
)
values
  (
    'aaaa1111-1111-4111-8111-111111111111',
    '11111111-1111-4111-8111-111111111111',
    '장안구',
    '정자동',
    '정자시장 입구 앞',
    '칼갈이 트럭',
    '칼의부활 수원트럭',
    '가위 포함 접수 중. 줄은 3팀 정도.',
    '시장상인',
    37.3032,
    126.9991,
    true,
    92,
    'active',
    'seed_report',
    '2026-03-20T09:10:00+09:00'
  ),
  (
    'bbbb2222-2222-4222-8222-222222222222',
    '33333333-3333-4333-8333-333333333333',
    '팔달구',
    '행궁동',
    '행궁동 공영주차장 앞',
    '칼갈이 트럭',
    '대장장이 칼갈이',
    '시장 방향으로 이동 예정.',
    '행궁동 주민',
    37.2825,
    127.0147,
    true,
    88,
    'active',
    'seed_report',
    '2026-03-20T10:05:00+09:00'
  ),
  (
    'cccc3333-3333-4333-8333-333333333333',
    '22222222-2222-4222-8222-222222222222',
    '영통구',
    '매탄동',
    '매탄공원 남측',
    '이동식 칼갈이 밴',
    '신의칼 출장연마',
    '세라믹 문의가 많았음.',
    '아파트 주민',
    37.2663,
    127.0401,
    false,
    79,
    'active',
    'seed_report',
    '2026-03-20T08:30:00+09:00'
  ),
  (
    'dddd4444-4444-4444-8444-444444444444',
    null,
    '권선구',
    '세류동',
    '세류2동 주민센터 인근',
    '주민센터 칼갈이 부스',
    '주민센터 연계',
    '우산 수리와 함께 운영하는 듯 보임.',
    '동네 제보',
    37.2551,
    127.0135,
    true,
    84,
    'active',
    'community_report',
    '2026-03-19T15:20:00+09:00'
  )
on conflict (id) do nothing;

insert into public.alert_subscriptions (
  id,
  district,
  anchor_neighborhood,
  radius_meters,
  channel,
  nickname,
  note
)
values
  (
    'eeee5555-5555-4555-8555-555555555555',
    '팔달구',
    '행궁동',
    1000,
    '웹 푸시',
    '행궁동 알림',
    '저녁 시간대 제보 우선'
  ),
  (
    'ffff6666-6666-4666-8666-666666666666',
    '영통구',
    '매탄동',
    1500,
    '카카오 알림톡',
    '매탄동 주방팀',
    '업장용 칼갈이 제보 선호'
  )
on conflict (id) do nothing;
