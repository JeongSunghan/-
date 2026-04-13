import type { Provider, Report } from "@/lib/types";

export function formatReportedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return new Intl.DateTimeFormat("ko-KR", {
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

export function formatRelative(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const diffMinutes = Math.round((Date.now() - date.getTime()) / 60000);
  if (diffMinutes <= 1) {
    return "방금 전";
  }
  if (diffMinutes < 60) {
    return `${diffMinutes}분 전`;
  }
  if (diffMinutes < 24 * 60) {
    return `${Math.round(diffMinutes / 60)}시간 전`;
  }
  return formatReportedAt(value);
}

export function getDisplayLabel(report: Report) {
  return (
    report.reportedLabel ||
    formatRelative(report.reportedAt) ||
    formatReportedAt(report.reportedAt)
  );
}

export function getTrustTone(score: number) {
  if (score >= 85) {
    return "high";
  }
  if (score >= 70) {
    return "mid";
  }
  return "low";
}

export function getSourceLabel(sourceType: Report["sourceType"]) {
  if (sourceType === "user_report") {
    return "현장 제보";
  }
  if (sourceType === "community_report") {
    return "동네 소식";
  }
  return "기본 등록";
}

export type PulseRow = {
  label: string;
  district: string;
  count: number;
  photoCount: number;
  maxTrust: number;
};

export function buildNeighborhoodPulse(reports: Report[]): PulseRow[] {
  const pulseMap = new Map<
    string,
    { label: string; district: string; count: number; photoCount: number; maxTrust: number }
  >();

  reports.forEach((report) => {
    const key = `${report.district}-${report.neighborhood}`;
    const current = pulseMap.get(key) ?? {
      label: report.neighborhood,
      district: report.district,
      count: 0,
      photoCount: 0,
      maxTrust: 0,
    };

    current.count += 1;
    current.photoCount += report.hasPhoto ? 1 : 0;
    current.maxTrust = Math.max(current.maxTrust, report.trustScore);
    pulseMap.set(key, current);
  });

  return [...pulseMap.values()]
    .sort((left, right) => right.count - left.count || right.maxTrust - left.maxTrust)
    .slice(0, 4);
}

export function buildTrustScore(
  hasPhoto: boolean,
  note: string,
  matchedProvider: Provider | undefined,
) {
  let score = 58;

  if (hasPhoto) {
    score += 18;
  }
  if (matchedProvider) {
    score += 12;
  }
  if (note.trim().length >= 10) {
    score += 8;
  }

  return Math.min(score, 96);
}
