import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

const MINUTE_MS = 60_000;

/**
 * `valid_to`(ISO)까지 남은 시간을 시·분만 표시(초 없음). 1분마다 갱신.
 */
export function useMissionRemainingLabel(validToIso: string | undefined | null): string | null {
  const { t } = useTranslation();
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    if (!validToIso) {
      setLabel(null);
      return;
    }

    function compute(): string | null {
      const end = Date.parse(validToIso);
      if (Number.isNaN(end)) return null;
      const remainingMs = end - Date.now();
      if (remainingMs <= 0) {
        return t('mission.remainingExpired');
      }
      const totalMinutes = Math.floor(remainingMs / MINUTE_MS);
      if (totalMinutes < 1) {
        return t('mission.remainingUnderMinute');
      }
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      if (hours > 0) {
        return t('mission.remainingHoursMinutes', { hours, minutes });
      }
      return t('mission.remainingMinutesOnly', { minutes });
    }

    setLabel(compute());
    const id = setInterval(() => setLabel(compute()), MINUTE_MS);
    return () => clearInterval(id);
  }, [validToIso, t]);

  return label;
}
