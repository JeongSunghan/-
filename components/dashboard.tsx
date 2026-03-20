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
    "GPS는 선택입니다. 이후 Kakao 지도 반경 매칭의 기준점으로 사용됩니다."
  );
  const [dataStatus, setDataStatus] = useState(
    hasSupabaseEnv
      ? "Supabase 연결을 확인하는 중입니다."
      : "Supabase env가 없어 mock 데이터와 localStorage로 실행 중입니다."
  );
  const [reportStatus, setReportStatus] = useState(
    "제보는 즉시 카드 피드에 반영됩니다."
  );
  const [subscriptionStatus, setSubscriptionStatus] = useState(
    hasSupabaseEnv
      ? "구독 저장은 localStorage와 Supabase를 함께 시도합니다."
      : "env 연결 전에는 브라우저에만 저장됩니다."
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
            ? "Supabase 데이터를 불러왔습니다."
            : "Supabase는 연결됐지만 아직 실데이터가 없습니다."
        );
      } catch {
        if (!cancelled) {
          setDataStatus("Supabase 연결에 실패해 mock 데이터로 계속 진행합니다.");
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
    ? "Supabase Env Needed"
    : dataStatus.includes("불러왔") || dataStatus.includes("연결됐")
      ? "Supabase Live"
      : dataStatus.includes("실패")
        ? "Supabase Fallback"
        : "Supabase Connecting";

  function handleGeolocation() {
    if (!navigator.geolocation) {
      setGeoStatus("이 브라우저는 위치 정보를 지원하지 않습니다.");
      return;
    }

    setGeoStatus("위치를 가져오는 중...");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGeoPoint({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setGeoStatus(
          `위치 저장됨: ${position.coords.latitude.toFixed(4)}, ${position.coords.longitude.toFixed(4)}`
        );
      },
      () => {
        setGeoStatus("권한이 없어도 제보는 가능합니다. 구/동과 장소만 입력하세요.");
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

    setReportStatus("제보 저장 중입니다.");

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

        setReportStatus("Supabase reports 테이블에 저장했습니다.");
        form.reset();
        setGeoPoint(null);
        setGeoStatus(
          "GPS는 선택입니다. 이후 Kakao 지도 반경 매칭의 기준점으로 사용됩니다."
        );
        return;
      } catch {
        setReportStatus("Supabase 저장에 실패해 브라우저 로컬 저장으로 대체했습니다.");
      }
    }

    startTransition(() => {
      const nextRows = [draftReport, ...userReports];
      setUserReports(nextRows);
      writeLocalRows(STORAGE_KEYS.reports, nextRows);
      setLatestReport(draftReport);
      setSelectedDistrict(district);
    });

    setReportStatus("로컬 저장으로 반영했습니다.");
    form.reset();
    setGeoPoint(null);
    setGeoStatus(
      "GPS는 선택입니다. 이후 Kakao 지도 반경 매칭의 기준점으로 사용됩니다."
    );
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

    setSubscriptionStatus("알림 구독 저장 중입니다.");

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
        setSubscriptionStatus("Supabase alert_subscriptions 테이블에도 저장했습니다.");
      } catch {
        setSubscriptionStatus(
          "Supabase 저장은 실패했고, 브라우저 로컬 저장은 유지했습니다."
        );
      }
    } else {
      setSubscriptionStatus("env 연결 전이므로 브라우저 로컬 저장으로 반영했습니다.");
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
    <div className="page-shell">
      <header className="hero surface">
        <div className="topbar">
          <div>
            <p className="eyebrow">KnifeTruck</p>
            <h1>수원 제보형 칼갈이 알림 MVP</h1>
          </div>
          <div className="pill-row">
            <span className="pill">{supabaseLabel}</span>
            <span className="pill pill-muted">Kakao Maps Later</span>
            <span className="pill pill-muted">Public Repo</span>
          </div>
        </div>

        <div className="hero-grid">
          <div>
            <p className="hero-copy">
              핵심은 provider 목록이 아니라 report 흐름입니다. 제보를 먼저 저장하고,
              그 위에 alert subscription과 official provider base를 덧붙이는 구조로
              앱을 시작합니다.
            </p>
            <div className="cta-row">
              <a className="button button-primary" href="#report-form">
                지금 제보하기
              </a>
              <a className="button button-secondary" href="#subscription-form">
                알림 설정
              </a>
            </div>
          </div>

          <div className="stat-grid">
            <article className="stat-card">
              <span>최근 제보</span>
              <strong>{reports.length}</strong>
            </article>
            <article className="stat-card">
              <span>활성 구역</span>
              <strong>{new Set(reports.map((report) => report.district)).size}</strong>
            </article>
            <article className="stat-card">
              <span>Bootstrap Providers</span>
              <strong>{providerCatalog.length}</strong>
            </article>
            <article className="stat-card">
              <span>알림 구독</span>
              <strong>{subscriptions.length}</strong>
            </article>
          </div>
        </div>
        <p className="status-text">{dataStatus}</p>
      </header>

      <section className="section surface">
        <div className="section-head">
          <div>
            <p className="eyebrow">Recent Reports</p>
            <h2>최근 제보 피드</h2>
          </div>
          <div className="filter-row">
            {DISTRICTS.map((district) => (
              <button
                key={district}
                type="button"
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
            <h3>운영 인사이트</h3>
            <div className="insight-grid">
              <article className="insight-card">
                <span>선택 구역</span>
                <strong>{selectedDistrict === "all" ? "수원 전체" : selectedDistrict}</strong>
              </article>
              <article className="insight-card">
                <span>사진 포함</span>
                <strong>{photoCount}건</strong>
              </article>
              <article className="insight-card">
                <span>평균 신뢰도</span>
                <strong>{averageTrust || "-"}점</strong>
              </article>
              <article className="insight-card insight-wide">
                <span>가장 최근 신호</span>
                <strong>
                  {latestVisibleReport
                    ? `${latestVisibleReport.district} ${latestVisibleReport.neighborhood} · ${latestVisibleReport.place}`
                    : "최근 신호 없음"}
                </strong>
              </article>
            </div>
            <p className="section-note">
              Kakao Maps 연동 전 단계에서는 report 밀도와 대표 위치를 카드로 먼저
              검증합니다.
            </p>
          </aside>

          <div className="feed-column">
            {visibleReports.map((report) => {
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
                        신뢰 {report.trustScore}
                      </span>
                    </div>
                    <h3>{report.place}</h3>
                    <p className="report-description">
                      {report.truckType} · {provider?.name ?? report.providerHint ?? "미확인 트럭"}
                    </p>
                    <p className="report-description">{report.note || "메모 없음"}</p>
                    <div className="meta-row">
                      <span>{report.hasPhoto ? "사진 있음" : "사진 없음"}</span>
                      <span>{report.reporterAlias || "익명 제보"}</span>
                      <span>{report.sourceType}</span>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="section surface">
        <div className="section-head">
          <div>
            <p className="eyebrow">Neighborhood Pulse</p>
            <h2>동네별 신호 요약</h2>
          </div>
        </div>
        <div className="info-grid">
          {pulseRows.map((row) => (
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
          ))}
        </div>
      </section>

      <section className="section surface duo-grid">
        <form id="report-form" className="form-panel" onSubmit={handleReportSubmit}>
          <div className="section-head">
            <div>
              <p className="eyebrow">Fast Report</p>
              <h2>지금 여기 있음 제보</h2>
            </div>
          </div>
          <div className="form-grid">
            <label>
              구
              <select name="district" required defaultValue="">
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
              <input name="neighborhood" placeholder="예: 행궁동" required />
            </label>
            <label>
              발견 장소
              <input name="place" placeholder="예: 행궁동 공영주차장 앞" required />
            </label>
            <label>
              트럭 유형
              <select name="truckType" required defaultValue="">
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
              <input name="providerHint" placeholder="예: 칼의부활, 대장장이" />
            </label>
            <label>
              사진 여부
              <select name="hasPhoto" defaultValue="yes">
                <option value="yes">사진 있음</option>
                <option value="no">사진 없음</option>
              </select>
            </label>
            <label>
              제보자 닉네임
              <input name="reporterAlias" placeholder="선택 입력" />
            </label>
            <label className="field-span">
              메모
              <textarea
                name="note"
                rows={4}
                placeholder="예: 줄 4팀 정도, 가위 가능"
              />
            </label>
          </div>
          <div className="cta-row">
            <button type="button" className="button button-secondary" onClick={handleGeolocation}>
              현재 위치 가져오기
            </button>
            <button type="submit" className="button button-primary">
              제보 저장
            </button>
          </div>
          <p className="section-note">{geoStatus}</p>
          <p className="status-text">{reportStatus}</p>
        </form>

        <aside className="summary-panel">
          <p className="eyebrow">Latest Save</p>
          <h2>
            {latestReport
              ? `${latestReport.district} ${latestReport.neighborhood}`
              : "아직 저장된 제보 없음"}
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
            다음 단계에서는 이 저장이 Supabase reports 테이블과 Storage 버킷으로 연결됩니다.
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
              <p className="eyebrow">Alert Subscription</p>
              <h2>우리 동네 알림 설정</h2>
            </div>
          </div>
          <div className="form-grid">
            <label>
              관심 구
              <select name="district" required defaultValue="">
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
              <input name="anchorNeighborhood" placeholder="예: 인계동" required />
            </label>
            <label>
              반경
              <select name="radiusMeters" defaultValue="1000">
                <option value="500">500m</option>
                <option value="1000">1km</option>
                <option value="1500">1.5km</option>
                <option value="3000">3km</option>
              </select>
            </label>
            <label>
              채널
              <select name="channel" defaultValue="웹 푸시">
                <option value="웹 푸시">웹 푸시</option>
                <option value="카카오 알림톡">카카오 알림톡</option>
                <option value="문자">문자</option>
              </select>
            </label>
            <label>
              별칭
              <input name="nickname" placeholder="예: 행궁동 알림" />
            </label>
            <label className="field-span">
              메모
              <textarea
                name="note"
                rows={4}
                placeholder="예: 저녁 시간대 제보 우선"
              />
            </label>
          </div>
          <div className="cta-row">
            <button type="submit" className="button button-primary">
              구독 저장
            </button>
          </div>
          <p className="status-text">{subscriptionStatus}</p>
        </form>

        <aside className="summary-panel">
          <p className="eyebrow">Subscription State</p>
          <h2>
            {latestSubscription
              ? latestSubscription.nickname || `${latestSubscription.district} 알림`
              : "아직 저장된 알림 없음"}
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
            {subscriptions.slice(0, 4).map((subscription) => (
              <article key={subscription.id} className="stack-card">
                <strong>
                  {subscription.nickname || `${subscription.district} 알림`}
                </strong>
                <p>
                  {subscription.district} {subscription.anchorNeighborhood} ·{" "}
                  {subscription.radiusMeters}m
                </p>
              </article>
            ))}
          </div>
        </aside>
      </section>

      <section className="section surface">
        <div className="section-head">
          <div>
            <p className="eyebrow">Bootstrap Providers</p>
            <h2>보조 provider 카탈로그</h2>
          </div>
          <p className="section-note">
            official registry가 쌓이기 전까지는 bootstrap 데이터가 검수와 초기 지도
            채우기를 돕습니다.
          </p>
        </div>
        <div className="provider-grid">
          {providerCatalog.map((provider) => (
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
                  <span>가격 힌트</span>
                  <strong>{provider.priceHints.join(", ")}</strong>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
