"use client";

import { startTransition, useState, type FormEvent } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { insertReport } from "@/lib/supabase/repository";
import { writeLocalRows, STORAGE_KEYS } from "@/lib/storage";
import { buildTrustScore } from "@/lib/utils";
import type { District, Provider, Report } from "@/lib/types";

const DISTRICTS: District[] = ["장안구", "권선구", "팔달구", "영통구"];

type ReportFormSectionProps = {
  providerCatalog: Provider[];
  onReportSaved: (report: Report) => void;
  existingUserReports: Report[];
};

export default function ReportFormSection({
  providerCatalog,
  onReportSaved,
  existingUserReports,
}: ReportFormSectionProps) {
  const [geoPoint, setGeoPoint] = useState<{ lat: number; lng: number } | null>(
    null,
  );
  const [geoStatus, setGeoStatus] = useState(
    "위치는 선택 사항이에요. 구와 장소만 적어도 제보할 수 있어요.",
  );
  const [reportStatus, setReportStatus] = useState(
    "간단히 적어 주시면 바로 목록에 반영돼요.",
  );
  const [latestReport, setLatestReport] = useState<Report | null>(
    existingUserReports[0] ?? null,
  );
  const [quickMode, setQuickMode] = useState(true);

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
          `현재 위치를 담아뒀어요: ${position.coords.latitude.toFixed(4)}, ${position.coords.longitude.toFixed(4)}`,
        );
      },
      () => {
        setGeoStatus(
          "위치를 허용하지 않아도 괜찮아요. 구와 장소만 적어도 제보할 수 있어요.",
        );
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = event.currentTarget;
    const formData = new FormData(form);
    const district = formData.get("district") as District;
    const providerHint = String(formData.get("providerHint") ?? "").trim();
    const matchedProvider = providerCatalog.find((provider) =>
      providerHint ? provider.name.includes(providerHint) : false,
    );
    const note = String(formData.get("note") ?? "");
    const hasPhoto = formData.get("hasPhoto") === "yes";

    const draftReport: Report = {
      id: `report-${Date.now()}`,
      district,
      neighborhood: String(formData.get("neighborhood") ?? "").trim(),
      place: String(formData.get("place") ?? "").trim(),
      truckType: quickMode
        ? "칼갈이 트럭"
        : String(formData.get("truckType") ?? "").trim(),
      providerId: matchedProvider?.id,
      providerHint: providerHint || undefined,
      reportedAt: new Date().toISOString(),
      trustScore: buildTrustScore(hasPhoto, note, matchedProvider),
      status: "active",
      hasPhoto: quickMode ? false : hasPhoto,
      reporterAlias: String(formData.get("reporterAlias") ?? "").trim() || undefined,
      note: note || undefined,
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
          setLatestReport(savedReport);
          onReportSaved(savedReport);
        });

        setReportStatus("제보가 올라갔어요. 다른 사람도 바로 볼 수 있어요.");
        form.reset();
        resetGeo();
        return;
      } catch {
        setReportStatus("연결이 잠시 불안정해 이 기기에 먼저 저장했어요.");
      }
    }

    startTransition(() => {
      const nextRows = [draftReport, ...existingUserReports];
      writeLocalRows(STORAGE_KEYS.reports, nextRows);
      setLatestReport(draftReport);
      onReportSaved(draftReport);
    });

    setReportStatus("제보를 이 기기에 저장해 두었어요.");
    form.reset();
    resetGeo();
  }

  function resetGeo() {
    setGeoPoint(null);
    setGeoStatus("위치는 선택 사항이에요. 구와 장소만 적어도 제보할 수 있어요.");
  }

  return (
    <section className="section surface duo-grid">
      <form id="report-form" className="form-panel" onSubmit={handleSubmit}>
        <div className="section-head">
          <div>
            <p className="eyebrow">바로 알리기</p>
            <h2>지금 본 트럭 알려주기</h2>
          </div>
          <button
            type="button"
            className="button button-secondary quick-toggle"
            onClick={() => setQuickMode((prev) => !prev)}
          >
            {quickMode ? "상세 입력" : "간단 입력"}
          </button>
        </div>
        <div className="form-grid">
          <label>
            구
            <select name="district" autoComplete="off" required defaultValue="">
              <option value="" disabled>
                구 선택
              </option>
              {DISTRICTS.map((district) => (
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
          <label className={quickMode ? "field-span" : ""}>
            발견 장소
            <input
              autoComplete="street-address"
              name="place"
              placeholder="예: 행궁동 공영주차장 앞…"
              required
              type="text"
            />
          </label>

          {!quickMode && (
            <>
              <label>
                트럭 유형
                <select
                  name="truckType"
                  autoComplete="off"
                  required
                  defaultValue=""
                >
                  <option value="" disabled>
                    유형 선택
                  </option>
                  <option value="칼갈이 트럭">칼갈이 트럭</option>
                  <option value="이동식 칼갈이 밴">이동식 칼갈이 밴</option>
                  <option value="주민센터 칼갈이 부스">
                    주민센터 칼갈이 부스
                  </option>
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
            </>
          )}
        </div>
        <div className="cta-row">
          <button
            type="button"
            className="button button-secondary"
            onClick={handleGeolocation}
          >
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
  );
}
