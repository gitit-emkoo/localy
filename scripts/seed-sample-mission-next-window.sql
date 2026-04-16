-- 수동 실행용: "지금 활성 미션이 없을 때" 다음 샘플 미션 1건을 넣습니다.
-- Supabase SQL Editor에서 붙여넣고 Run 하세요.
--
-- 동작:
-- - 현재 valid_from <= now() < valid_to 인 published 미션이 있으면 아무 것도 하지 않습니다.
-- - 없으면, 기존 published 중 가장 늦은 valid_to 와 now() 중 늦은 시각을 시작으로 24시간 창을 엽니다.
-- - category_key는 UI 매핑용으로 daily_life 고정입니다.

INSERT INTO public.missions (
  mission_date,
  category_key,
  title,
  short_description,
  notice_text,
  is_time_sensitive,
  status,
  valid_from,
  valid_to
)
SELECT
  (vf AT TIME ZONE 'UTC')::date,
  'daily_life',
  'Sample mission',
  'Complete the same mission in different countries today.',
  '',
  false,
  'published',
  vf,
  vf + interval '24 hours'
FROM (
  SELECT GREATEST(
    COALESCE(
      (SELECT MAX(m.valid_to) FROM public.missions m WHERE m.status = 'published'),
      TIMESTAMPTZ 'epoch'
    ),
    now()
  ) AS vf
) anchor
WHERE NOT EXISTS (
  SELECT 1
  FROM public.missions m
  WHERE m.status = 'published'
    AND m.valid_from <= now()
    AND m.valid_to > now()
);

-- 확인
-- SELECT * FROM public.get_active_mission();
