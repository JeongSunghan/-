"use client";

import {
  startTransition,
  useDeferredValue,
  useEffect,
  useState,
  type FormEvent,
} from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  fetchProviders,
  fetchReports,
  insertAlertSubscription,
  insertReport,
} from "@/lib/supabase/repository";
import type { AlertSubscription, District, Provider, Report } from "@/lib/types";

const DISTRICTS: Array<District | "all"> = [
  "all",
  "장안구",
  "권선구",
  "팔달구",
  "영통구",
];

const STORAGE_KEYS = {
  reports: "knife-truck.user-reports.v1",
  alerts: "knife-truck.user-alerts.v1",
};

type DashboardProps = {
  initialProviders: Provider[];
  initialReports: Report[];
  initialSubscriptions: AlertSubscription[];
  hasSupabaseEnv: boolean;
};

function readLocalRows<T>(key: string): T[] {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function writeLocalRows<T>(key: string, rows: T[]) {
  window.localStorage.setItem(key, JSON.stringify(rows));
}

function formatReportedAt(value: string) {
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

function formatRelative(value: string) {
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

function getDisplayLabel(report: Report) {
  return (
    report.reportedLabel ||
    formatRelative(report.reportedAt) ||
    formatReportedAt(report.reportedAt)
  );
}

function getTrustTone(score: number) {
  if (score >= 85) {
    return "high";
  }
  if (score >= 70) {
    return "mid";
  }
  return "low";
}

function getSourceLabel(sourceType: Report["sourceType"]) {
  if (sourceType === "user_report") {
    return "현장 제보";
  }
  if (sourceType === "community_report") {
    return "동네 소식";
  }
  return "기본 등록";
}

function buildNeighborhoodPulse(reports: Report[]) {
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

function buildTrustScore(
  hasPhoto: boolean,
  note: string,
  matchedProvider: Provider | undefined
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

export default function Dashboard({
  initialProviders,
  initialReports,
  initialSubscriptions,
  hasSupabaseEnv,
}: DashboardProps) {
  const [providerRows, setProviderRows] = useState(initialProviders);
  const [seedReports, setSeedReports] = useState(initialReports);
  const [selectedDistrict, setSelectedDistrict] = useState<District | "all">("all");
  const [userReports, setUserReports] = useState<Report[]>([]);
  const [userSubscriptions, setUserSubscriptions] = useState<AlertSubscription[]>(
    []
  );
  const [latestReport, setLatestReport] = useState<Report | null>(null);
  const [latestSubscription, setLatestSubscription] =
    useState<AlertSubscription | null>(null);
  const [geoPoint, setGeoPoint] = useState<{ lat: number; lng: number } | null>(
    null
  );
  const [geoStatus, setGeoStatus] = useState(
    "위치는 선택 사항이에요. 구와 장소만 적어도 제보할 수 있어요."
  );
  const [dataStatus, setDataStatus] = useState(
    hasSupabaseEnv
      ? "주변 제보를 불러오는 중입니다."
      : "현재는 예시 제보로 둘러보는 화면입니다."
  );
  const [reportStatus, setReportStatus] = useState(
    "간단히 적어 주시면 바로 목록에 반영돼요."
  );
  const [subscriptionStatus, setSubscriptionStatus] = useState(
    hasSupabaseEnv
      ? "원하는 동네를 저장해 두면 다음 소식을 더 빨리 확인할 수 있어요."
      : "지금은 이 기기에만 알림 설정이 저장됩니다."
  );

  useEffect(() => {
    const storedReports = readLocalRows<Report>(STORAGE_KEYS.reports);
    const storedAlerts = readLocalRows<AlertSubscription>(STORAGE_KEYS.alerts);
    setUserReports(storedReports);
    setUserSubscriptions(storedAlerts);
    setLatestReport(storedReports[0] ?? null);
    setLatestSubscription(storedAlerts[0] ?? null);
  }, []);

  useEffect(() => {
    const client = getSupabaseBrowserClient();
    if (!client) {
      return;
    }

    let cancelled = false;

    async function hydrateFromSupabase() {
      try {
        const [nextProviders, nextReports] = await Promise.all([
          fetchProviders(client),
          fetchReports(client),
        ]);

        if (cancelled) {
          return;
        }

        if (nextProviders.length > 0) {
          setProviderRows(nextProviders);
        }

        if (nextReports.length > 0) {
          setSeedReports(nextReports);
        }

        setDataStatus(
          nextReports.length > 0 || nextProviders.length > 0
            ? "지금 들어온 제보를 순서대로 보여드리고 있어요."
            : "아직 등록된 소식이 많지 않아 첫 제보를 기다리고 있어요."
        );
      } catch {
        if (!cancelled) {
          setDataStatus("연결이 잠시 불안정해 예시 화면으로 보여드리고 있어요.");
        }
      }
    }

    void hydrateFromSupabase();

    return () => {
      cancelled = true;
    };
  }, []);

  const deferredDistrict = useDeferredValue(selectedDistrict);
  const providerCatalog = providerRows.length > 0 ? providerRows : initialProviders;
  const baseReports = seedReports.length > 0 ? seedReports : initialReports;
  const reports = [...userReports, ...baseReports].sort(
    (left, right) =>
      new Date(right.reportedAt).getTime() - new Date(left.reportedAt).getTime()
  );
  const subscriptions = [...userSubscriptions, ...initialSubscriptions];
  const visibleReports =
    deferredDistrict === "all"
      ? reports
      : reports.filter((report) => report.district === deferredDistrict);
  const districtCounts = DISTRICTS.reduce<Record<string, number>>((acc, district) => {
    if (district === "all") {
      acc[district] = reports.length;
      return acc;
    }
    acc[district] = reports.filter((report) => report.district === district).length;
    return acc;
  }, {});
  const pulseRows = buildNeighborhoodPulse(visibleReports);
  const latestVisibleReport = visibleReports[0] ?? null;
  const photoCount = visibleReports.filter((report) => report.hasPhoto).length;
  const averageTrust = visibleReports.length
    ? Math.round(
        visibleReports.reduce((sum, report) => sum + report.trustScore, 0) /
          visibleReports.length
      )
    : 0;
  const supabaseLabel = !hasSupabaseEnv
    ? "시범 화면"
    : dataStatus.includes("순서대로")
      ? "실시간 소식"
      : dataStatus.includes("불안정")
        ? "예시 화면"
        : "불러오는 중";

  function handleGeolocation() {
    if (!navigator.geolocation) {
      setGeoStatus("이 기기에서는 위치 기능을 바로 사용할 수 없어요.");
      return;
    }

    setGeoStatus("내 위치를 가져오는 중이에요…");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGeoPoint({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setGeoStatus(
          `현재 위치를 담아뒀어요: ${position.coords.latitude.toFixed(4)}, ${position.coords.longitude.toFixed(4)}`
        );
      },
      () => {
        setGeoStatus("위치를 허용하지 않아도 괜찮아요. 구와 장소만 적어도 제보할 수 있어요.");
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }

  async function handleReportSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = event.currentTarget;
    const formData = new FormData(form);
    const district = formData.get("district") as District;
    const providerHint = String(formData.get("providerHint") ?? "").trim();
    const matchedProvider = providerCatalog.find((provider) =>
      providerHint ? provider.name.includes(providerHint) : false
    );
    const note = String(formData.get("note") ?? "");
    const hasPhoto = formData.get("hasPhoto") === "yes";

    const draftReport: Report = {
      id: `report-${Date.now()}`,
      district,
      neighborhood: String(formData.get("neighborhood") ?? "").trim(),
      place: String(formData.get("place") ?? "").trim(),
      truckType: String(formData.get("truckType") ?? "").trim(),
      providerId: matchedProvider?.id,
      providerHint,
      reportedAt: new Date().toISOString(),
      trustScore: buildTrustScore(hasPhoto, note, matchedProvider),
      status: "active",
      hasPhoto,
      reporterAlias: String(formData.get("reporterAlias") ?? "").trim(),
      note,
      lat: geoPoint?.lat ?? null,
      lng: geoPoint?.lng ?? null,
      sourceType: "user_report",
    };

    setReportStatus("제보를 저장하고 있어요…");

    const client = getSupabaseBrowserClient();
    if (client) {
      try {
        const savedReport = await insertReport(client, {
          district: draftReport.district,
          neighborhood: draftReport.neighborhood,
          place: draftReport.place,
          truckType: draftReport.truckType,
          providerId: draftReport.providerId,
          providerHint: draftReport.providerHint,
          note: draftReport.note,
          reporterAlias: draftReport.reporterAlias,
          lat: draftReport.lat,
          lng: draftReport.lng,
          hasPhoto: draftReport.hasPhoto,
          trustScore: draftReport.trustScore,
          status: draftReport.status,
          sourceType: draftReport.sourceType,
        });

        startTransition(() => {
          setUserReports((current) => [savedReport, ...current]);
          setLatestReport(savedReport);
          setSelectedDistrict(savedReport.district);
        });

        setReportStatus("제보가 올라갔어요. 다른 사람도 바로 볼 수 있어요.");
        form.reset();
        setGeoPoint(null);
        setGeoStatus("위치는 선택 사항이에요. 구와 장소만 적어도 제보할 수 있어요.");
        return;
      } catch {
        setReportStatus("연결이 잠시 불안정해 이 기기에 먼저 저장했어요.");
      }
    }

    startTransition(() => {
      const nextRows = [draftReport, ...userReports];
      setUserReports(nextRows);
      writeLocalRows(STORAGE_KEYS.reports, nextRows);
      setLatestReport(draftReport);
      setSelectedDistrict(district);
    });

    setReportStatus("제보를 이 기기에 저장해 두었어요.");
    form.reset();
    setGeoPoint(null);
    setGeoStatus("위치는 선택 사항이에요. 구와 장소만 적어도 제보할 수 있어요.");
  }

  async function handleSubscriptionSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = event.currentTarget;
    const formData = new FormData(form);
    const draftSubscription: AlertSubscription = {
      id: `alert-${Date.now()}`,
      district: formData.get("district") as District,
      anchorNeighborhood: String(formData.get("anchorNeighborhood") ?? "").trim(),
      radiusMeters: Number(formData.get("radiusMeters") ?? 1000),
      channel: formData.get("channel") as AlertSubscription["channel"],
      nickname: String(formData.get("nickname") ?? "").trim(),
      note: String(formData.get("note") ?? "").trim(),
      sourceType: "user",
    };

    setSubscriptionStatus("알림 설정을 저장하고 있어요…");

    const client = getSupabaseBrowserClient();
    let nextSubscription = draftSubscription;

    if (client) {
      try {
        nextSubscription = await insertAlertSubscription(client, {
          district: draftSubscription.district,
          anchorNeighborhood: draftSubscription.anchorNeighborhood,
          radiusMeters: draftSubscription.radiusMeters,
          channel: draftSubscription.channel,
          nickname: draftSubscription.nickname,
          note: draftSubscription.note,
        });
        setSubscriptionStatus("알림 설정을 저장했어요. 다음 소식을 더 빨리 확인할 수 있어요.");
      } catch {
        setSubscriptionStatus("연결이 잠시 불안정해도 이 기기에는 알림 설정을 남겨뒀어요.");
      }
    } else {
      setSubscriptionStatus("지금은 이 기기에 알림 설정을 저장했어요.");
    }

    startTransition(() => {
      const nextRows = [nextSubscription, ...userSubscriptions];
      setUserSubscriptions(nextRows);
      writeLocalRows(STORAGE_KEYS.alerts, nextRows);
      setLatestSubscription(nextSubscription);
    });

    form.reset();
  }

  return (
    <main id="main-content" className="page-shell">
      <header className="hero surface">
        <div className="topbar">
          <div className="brand-lockup">
            <p className="eyebrow">우리 동네 칼갈이</p>
            <h1>칼갈이 트럭, 오늘 우리 동네에 왔는지 바로 확인하세요</h1>
          </div>
          <div className="pill-row">
            <span className="pill">{supabaseLabel}</span>
            <span className="pill pill-muted">수원 중심</span>
            <span className="pill pill-muted">동네 알림</span>
          </div>
        </div>

        <div className="hero-grid">
          <div className="hero-copy-column">
            <p className="hero-kicker">수원에서 먼저 시작하는 동네 제보 서비스</p>
            <p className="hero-copy">
              시장 앞이나 주민센터 근처에 잠깐 들르는 칼갈이 트럭은 놓치기 쉽습니다.
              본 사람이 알려주고, 필요한 사람은 바로 확인하고, 다음 방문도 알림으로
              챙길 수 있게 만든 화면입니다.
            </p>
            <div className="cta-row">
              <a className="button button-primary" href="#report-form">
                지금 본 곳 알려주기
              </a>
              <a className="button button-secondary" href="#subscription-form">
                우리 동네 알림 받기
              </a>
            </div>
            <div className="signal-strip" aria-label="서비스 핵심 흐름">
              <article className="signal-step">
                <span className="signal-index">01</span>
                <strong>본 사람이 알려요</strong>
                <p>어디에서 봤는지 간단히 적으면 바로 동네 소식이 됩니다.</p>
              </article>
              <article className="signal-step">
                <span className="signal-index">02</span>
                <strong>근처 소식을 봐요</strong>
                <p>방금 올라온 제보를 보고 헛걸음을 줄일 수 있어요.</p>
              </article>
              <article className="signal-step">
                <span className="signal-index">03</span>
                <strong>다음 방문도 챙겨요</strong>
                <p>자주 가는 동네는 저장해 두고 다시 왔을 때 놓치지 않아요.</p>
              </article>
            </div>
          </div>

          <div className="stat-grid">
            <article className="stat-card">
              <span>오늘 올라온 소식</span>
              <strong>{reports.length}</strong>
            </article>
            <article className="stat-card">
              <span>둘러볼 수 있는 지역</span>
              <strong>{new Set(reports.map((report) => report.district)).size}</strong>
            </article>
            <article className="stat-card">
              <span>함께 보는 장인</span>
              <strong>{providerCatalog.length}</strong>
            </article>
            <article className="stat-card">
              <span>알림 요청</span>
              <strong>{subscriptions.length}</strong>
            </article>
          </div>
        </div>
        <p className="status-text" role="status" aria-live="polite">
          {dataStatus}
        </p>
      </header>

      <section className="section surface">
        <div className="section-head">
          <div>
            <p className="eyebrow">방금 올라온 소식</p>
            <h2>지금 근처에서 본 칼갈이 트럭</h2>
          </div>
          <div className="filter-row">
            {DISTRICTS.map((district) => (
              <button
                key={district}
                type="button"
                aria-pressed={district === selectedDistrict}
                className={district === selectedDistrict ? "filter active" : "filter"}
                onClick={() => startTransition(() => setSelectedDistrict(district))}
              >
                {district === "all" ? "전체" : district}
                <span>{districtCounts[district]}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="report-grid">
          <aside className="map-panel">
            <h3>한눈에 보기</h3>
            <div className="insight-grid">
              <article className="insight-card">
                <span>보고 있는 지역</span>
                <strong>{selectedDistrict === "all" ? "수원 전체" : selectedDistrict}</strong>
              </article>
              <article className="insight-card">
                <span>사진 있는 제보</span>
                <strong>{photoCount}건</strong>
              </article>
              <article className="insight-card">
                <span>확인도 평균</span>
                <strong>{averageTrust || "-"}점</strong>
              </article>
              <article className="insight-card insight-wide">
                <span>가장 최근 소식</span>
                <strong>
                  {latestVisibleReport
                    ? `${latestVisibleReport.district} ${latestVisibleReport.neighborhood} · ${latestVisibleReport.place}`
                    : "새 소식 기다리는 중"}
                </strong>
              </article>
            </div>
            <p className="section-note">
              지도 기능이 붙기 전에는 최근 제보와 동네 분위기를 먼저 보여드리고 있어요.
            </p>
          </aside>

          <div className="feed-column">
            {visibleReports.length === 0 ? (
              <article className="empty-card">
                <h3>아직 이 지역의 새 소식이 없어요</h3>
                <p className="section-note">
                  가장 먼저 본 사람이 알려 주면 여기서 바로 확인할 수 있어요.
                </p>
              </article>
            ) : (
              visibleReports.map((report) => {
                const provider = providerCatalog.find(
                  (item) => item.id === report.providerId
                );

                return (
                  <article key={report.id} className="report-card">
                    <div className="report-meta">
                      <strong>{getDisplayLabel(report)}</strong>
                      <span>{formatReportedAt(report.reportedAt)}</span>
                    </div>
                    <div>
                      <div className="report-top">
                        <p className="report-area">
                          {report.district} · {report.neighborhood}
                        </p>
                        <span className={`trust-pill tone-${getTrustTone(report.trustScore)}`}>
                          확인도 {report.trustScore}
                        </span>
                      </div>
                      <h3>{report.place}</h3>
                      <p className="report-description">
                        {report.truckType} · {provider?.name ?? report.providerHint ?? "미확인 트럭"}
                      </p>
                      <p className="report-description">{report.note || "남겨진 설명이 아직 없어요."}</p>
                      <div className="meta-row">
                        <span>{report.hasPhoto ? "사진 있음" : "사진 없음"}</span>
                        <span>{report.reporterAlias || "익명 제보"}</span>
                        <span>{getSourceLabel(report.sourceType)}</span>
                      </div>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </div>
      </section>

      <section className="section surface">
        <div className="section-head">
          <div>
            <p className="eyebrow">많이 보이는 곳</p>
            <h2>요즘 소식이 자주 올라오는 동네</h2>
          </div>
        </div>
        <div className="info-grid">
          {pulseRows.length === 0 ? (
            <article className="empty-card">
              <h3>요약할 소식이 아직 없어요</h3>
              <p className="section-note">
                제보가 쌓이면 동네별 사진 수와 최고 신뢰도가 자동 집계됩니다.
              </p>
            </article>
          ) : (
            pulseRows.map((row) => (
              <article key={`${row.district}-${row.label}`} className="info-card">
                <p className="eyebrow">{row.district}</p>
                <h3>{row.label}</h3>
                <div className="metric-list">
                  <div>
                    <span>제보</span>
                    <strong>{row.count}건</strong>
                  </div>
                  <div>
                    <span>사진</span>
                    <strong>{row.photoCount}건</strong>
                  </div>
                  <div>
                    <span>최고 신뢰도</span>
                    <strong>{row.maxTrust}</strong>
                  </div>
                </div>
              </article>
            ))
          )}
        </div>
      </section>

      <section className="section surface duo-grid">
        <form id="report-form" className="form-panel" onSubmit={handleReportSubmit}>
          <div className="section-head">
            <div>
              <p className="eyebrow">바로 알리기</p>
              <h2>지금 본 트럭 알려주기</h2>
            </div>
          </div>
          <div className="form-grid">
            <label>
              구
              <select name="district" autoComplete="off" required defaultValue="">
                <option value="" disabled>
                  구 선택
                </option>
                {DISTRICTS.filter((district) => district !== "all").map((district) => (
                  <option key={district} value={district}>
                    {district}
                  </option>
                ))}
              </select>
            </label>
            <label>
              동
              <input
                autoComplete="off"
                name="neighborhood"
                placeholder="예: 행궁동…"
                required
                type="text"
              />
            </label>
            <label>
              발견 장소
              <input
                autoComplete="street-address"
                name="place"
                placeholder="예: 행궁동 공영주차장 앞…"
                required
                type="text"
              />
            </label>
            <label>
              트럭 유형
              <select name="truckType" autoComplete="off" required defaultValue="">
                <option value="" disabled>
                  유형 선택
                </option>
                <option value="칼갈이 트럭">칼갈이 트럭</option>
                <option value="이동식 칼갈이 밴">이동식 칼갈이 밴</option>
                <option value="주민센터 칼갈이 부스">주민센터 칼갈이 부스</option>
              </select>
            </label>
            <label>
              상호 힌트
              <input
                autoComplete="organization"
                name="providerHint"
                placeholder="예: 칼의부활, 대장장이…"
                type="text"
              />
            </label>
            <label>
              사진 여부
              <select name="hasPhoto" autoComplete="off" defaultValue="yes">
                <option value="yes">사진 있음</option>
                <option value="no">사진 없음</option>
              </select>
            </label>
            <label>
              제보자 닉네임
              <input
                autoComplete="nickname"
                name="reporterAlias"
                placeholder="선택 입력…"
                type="text"
              />
            </label>
            <label className="field-span">
              메모
              <textarea
                autoComplete="off"
                name="note"
                placeholder="예: 줄 4팀 정도, 가위 가능…"
                rows={4}
              />
            </label>
          </div>
          <div className="cta-row">
            <button type="button" className="button button-secondary" onClick={handleGeolocation}>
              내 위치 담기
            </button>
            <button type="submit" className="button button-primary">
              제보 올리기
            </button>
          </div>
          <p className="section-note" role="status" aria-live="polite">
            {geoStatus}
          </p>
          <p className="status-text" role="status" aria-live="polite">
            {reportStatus}
          </p>
        </form>

        <aside className="summary-panel" aria-live="polite">
          <p className="eyebrow">방금 남긴 제보</p>
          <h2>
            {latestReport
              ? `${latestReport.district} ${latestReport.neighborhood}`
              : "아직 남긴 제보가 없어요"}
          </h2>
          <div className="metric-list">
            <div>
              <span>장소</span>
              <strong>{latestReport?.place ?? "-"}</strong>
            </div>
            <div>
              <span>유형</span>
              <strong>{latestReport?.truckType ?? "-"}</strong>
            </div>
            <div>
              <span>신뢰 점수</span>
              <strong>{latestReport?.trustScore ?? "-"}</strong>
            </div>
            <div>
              <span>좌표</span>
              <strong>
                {latestReport?.lat && latestReport?.lng
                  ? `${latestReport.lat.toFixed(4)}, ${latestReport.lng.toFixed(4)}`
                  : "-"}
              </strong>
            </div>
          </div>
          <p className="section-note">
            남긴 제보는 바로 목록에 쌓이고, 같은 동네 사람들에게도 도움이 됩니다.
          </p>
        </aside>
      </section>

      <section className="section surface duo-grid">
        <form
          id="subscription-form"
          className="form-panel"
          onSubmit={handleSubscriptionSubmit}
        >
          <div className="section-head">
            <div>
              <p className="eyebrow">다음 방문 챙기기</p>
              <h2>우리 동네 알림 받기</h2>
            </div>
          </div>
          <div className="form-grid">
            <label>
              관심 구
              <select name="district" autoComplete="off" required defaultValue="">
                <option value="" disabled>
                  구 선택
                </option>
                {DISTRICTS.filter((district) => district !== "all").map((district) => (
                  <option key={district} value={district}>
                    {district}
                  </option>
                ))}
              </select>
            </label>
            <label>
              기준 동
              <input
                autoComplete="off"
                name="anchorNeighborhood"
                placeholder="예: 인계동…"
                required
                type="text"
              />
            </label>
            <label>
              반경
              <select name="radiusMeters" autoComplete="off" defaultValue="1000">
                <option value="500">500m</option>
                <option value="1000">1km</option>
                <option value="1500">1.5km</option>
                <option value="3000">3km</option>
              </select>
            </label>
            <label>
              채널
              <select name="channel" autoComplete="off" defaultValue="웹 푸시">
                <option value="웹 푸시">웹 푸시</option>
                <option value="카카오 알림톡">카카오 알림톡</option>
                <option value="문자">문자</option>
              </select>
            </label>
            <label>
              별칭
              <input
                autoComplete="nickname"
                name="nickname"
                placeholder="예: 행궁동 알림…"
                type="text"
              />
            </label>
            <label className="field-span">
              메모
              <textarea
                autoComplete="off"
                name="note"
                placeholder="예: 저녁 시간대 제보 우선…"
                rows={4}
              />
            </label>
          </div>
          <div className="cta-row">
            <button type="submit" className="button button-primary">
              알림 저장
            </button>
          </div>
          <p className="status-text" role="status" aria-live="polite">
            {subscriptionStatus}
          </p>
        </form>

        <aside className="summary-panel" aria-live="polite">
          <p className="eyebrow">내 알림 설정</p>
          <h2>
            {latestSubscription
              ? latestSubscription.nickname || `${latestSubscription.district} 알림`
              : "아직 저장한 알림이 없어요"}
          </h2>
          <div className="metric-list">
            <div>
              <span>반경</span>
              <strong>
                {latestSubscription ? `${latestSubscription.radiusMeters}m` : "-"}
              </strong>
            </div>
            <div>
              <span>채널</span>
              <strong>{latestSubscription?.channel ?? "-"}</strong>
            </div>
            <div>
              <span>총 구독 수</span>
              <strong>{subscriptions.length}</strong>
            </div>
          </div>
          <div className="stack-list">
            {subscriptions.length === 0 ? (
              <article className="empty-card">
                <h3>첫 알림 구독을 기다리는 중</h3>
                <p className="section-note">
                  기준 동과 반경을 저장하면 여기에서 최근 구독 상태를 보여줍니다.
                </p>
              </article>
            ) : (
              subscriptions.slice(0, 4).map((subscription) => (
                <article key={subscription.id} className="stack-card">
                  <strong>
                    {subscription.nickname || `${subscription.district} 알림`}
                  </strong>
                  <p>
                    {subscription.district} {subscription.anchorNeighborhood} ·{" "}
                    {subscription.radiusMeters}m
                  </p>
                </article>
              ))
            )}
          </div>
        </aside>
      </section>

      <section className="section surface">
        <div className="section-head">
          <div>
            <p className="eyebrow">함께 보는 장인 정보</p>
            <h2>주변에서 활동하는 칼갈이 장인</h2>
          </div>
          <p className="section-note">
            정식 등록 전이라도 기본 정보는 함께 볼 수 있게 정리해 두었어요.
          </p>
        </div>
        <div className="provider-grid">
          {providerCatalog.length === 0 ? (
            <article className="empty-card">
              <h3>아직 공개된 장인 정보가 많지 않아요</h3>
              <p className="section-note">
                확인된 장인 정보가 늘어나면 이곳에서 한눈에 살펴볼 수 있어요.
              </p>
            </article>
          ) : (
            providerCatalog.map((provider) => (
              <article key={provider.id} className="provider-card">
                <div className="provider-top">
                  <div>
                    <p className="eyebrow">{provider.baseArea}</p>
                    <h3>{provider.name}</h3>
                  </div>
                  <span className="pill pill-muted">
                    {provider.mobileService ? "출장 가능" : "방문형"}
                  </span>
                </div>
                <p className="section-note">{provider.intro}</p>
                <div className="tag-row">
                  {provider.serviceTags.map((tag) => (
                    <span key={tag} className="tag">
                      {tag}
                    </span>
                  ))}
                </div>
                <div className="metric-list">
                  <div>
                    <span>활동 지역</span>
                    <strong>{provider.serviceAreas.join(", ")}</strong>
                  </div>
                  <div>
                    <span>가격 참고</span>
                    <strong>{provider.priceHints.join(", ")}</strong>
                  </div>
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    </main>
  );
}
