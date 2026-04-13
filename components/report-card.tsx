import type { Provider, Report } from "@/lib/types";
import {
  formatReportedAt,
  getDisplayLabel,
  getSourceLabel,
  getTrustTone,
} from "@/lib/utils";

type ReportCardProps = {
  report: Report;
  provider: Provider | undefined;
};

export default function ReportCard({ report, provider }: ReportCardProps) {
  return (
    <article className="report-card">
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
          {report.truckType} ·{" "}
          {provider?.name ?? report.providerHint ?? "미확인 트럭"}
        </p>
        <p className="report-description">
          {report.note || "남겨진 설명이 아직 없어요."}
        </p>
        <div className="meta-row">
          <span>{report.hasPhoto ? "사진 있음" : "사진 없음"}</span>
          <span>{report.reporterAlias || "익명 제보"}</span>
          <span>{getSourceLabel(report.sourceType)}</span>
        </div>
      </div>
    </article>
  );
}
