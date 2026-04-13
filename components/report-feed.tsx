import { startTransition, useMemo } from "react";
import type { District, Provider, Report } from "@/lib/types";
import type { MarkerData } from "@/lib/kakao-maps";
import KakaoMap from "./kakao-map";
import ReportCard from "./report-card";

type ReportFeedProps = {
  districts: Array<District | "all">;
  selectedDistrict: District | "all";
  onDistrictChange: (district: District | "all") => void;
  districtCounts: Record<string, number>;
  visibleReports: Report[];
  providerCatalog: Provider[];
  photoCount: number;
  averageTrust: number;
  latestVisibleReport: Report | null;
};

export default function ReportFeed({
  districts,
  selectedDistrict,
  onDistrictChange,
  districtCounts,
  visibleReports,
  providerCatalog,
  photoCount,
  averageTrust,
  latestVisibleReport,
}: ReportFeedProps) {
  const mapMarkers = useMemo<MarkerData[]>(() => {
    const reportMarkers: MarkerData[] = visibleReports
      .filter((r) => r.lat != null && r.lng != null)
      .map((r) => ({
        id: r.id,
        lat: r.lat!,
        lng: r.lng!,
        label: `${r.district} ${r.neighborhood} · ${r.place}`,
        type: "report" as const,
        trustScore: r.trustScore,
      }));

    const providerMarkers: MarkerData[] = providerCatalog
      .filter((p): p is Provider & { baseLat: number; baseLng: number } => false)
      .map((p) => ({
        id: p.id,
        lat: 0,
        lng: 0,
        label: p.name,
        type: "provider" as const,
      }));

    return [...reportMarkers, ...providerMarkers];
  }, [visibleReports, providerCatalog]);

  return (
    <section className="section surface">
      <div className="section-head">
        <div>
          <p className="eyebrow">방금 올라온 소식</p>
          <h2>지금 근처에서 본 칼갈이 트럭</h2>
        </div>
        <div className="filter-row">
          {districts.map((district) => (
            <button
              key={district}
              type="button"
              aria-pressed={district === selectedDistrict}
              className={
                district === selectedDistrict ? "filter active" : "filter"
              }
              onClick={() =>
                startTransition(() => onDistrictChange(district))
              }
            >
              {district === "all" ? "전체" : district}
              <span>{districtCounts[district]}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="report-grid">
        <aside className="map-panel">
          <KakaoMap markers={mapMarkers} />

          <div className="insight-grid">
            <article className="insight-card">
              <span>보고 있는 지역</span>
              <strong>
                {selectedDistrict === "all" ? "수원 전체" : selectedDistrict}
              </strong>
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
                (item) => item.id === report.providerId,
              );
              return (
                <ReportCard
                  key={report.id}
                  report={report}
                  provider={provider}
                />
              );
            })
          )}
        </div>
      </div>
    </section>
  );
}
