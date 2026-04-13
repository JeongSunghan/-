"use client";

import { startTransition, useDeferredValue, useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { fetchProviders, fetchReports } from "@/lib/supabase/repository";
import { readLocalRows, STORAGE_KEYS } from "@/lib/storage";
import { buildNeighborhoodPulse } from "@/lib/utils";
import type { AlertSubscription, District, Provider, Report } from "@/lib/types";

import Hero from "./hero";
import ReportFeed from "./report-feed";
import PulseSection from "./pulse-section";
import ReportFormSection from "./report-form-section";
import AlertFormSection from "./alert-form-section";
import ProviderSection from "./provider-section";
import QuickReportFab from "./quick-report-fab";

const DISTRICTS: Array<District | "all"> = [
  "all",
  "장안구",
  "권선구",
  "팔달구",
  "영통구",
];

type DashboardProps = {
  initialProviders: Provider[];
  initialReports: Report[];
  initialSubscriptions: AlertSubscription[];
  hasSupabaseEnv: boolean;
};

export default function Dashboard({
  initialProviders,
  initialReports,
  initialSubscriptions,
  hasSupabaseEnv,
}: DashboardProps) {
  const [providerRows, setProviderRows] = useState(initialProviders);
  const [seedReports, setSeedReports] = useState(initialReports);
  const [selectedDistrict, setSelectedDistrict] = useState<District | "all">(
    "all",
  );
  const [userReports, setUserReports] = useState<Report[]>([]);
  const [userSubscriptions, setUserSubscriptions] = useState<
    AlertSubscription[]
  >([]);
  const [dataStatus, setDataStatus] = useState(
    hasSupabaseEnv
      ? "주변 제보를 불러오는 중입니다."
      : "현재는 예시 제보로 둘러보는 화면입니다.",
  );

  /* ── localStorage hydration ── */
  useEffect(() => {
    setUserReports(readLocalRows<Report>(STORAGE_KEYS.reports));
    setUserSubscriptions(
      readLocalRows<AlertSubscription>(STORAGE_KEYS.alerts),
    );
  }, []);

  /* ── Supabase hydration ── */
  useEffect(() => {
    const client = getSupabaseBrowserClient();
    if (!client) return;

    const supabase = client;
    let cancelled = false;

    async function hydrateFromSupabase() {
      try {
        const [nextProviders, nextReports] = await Promise.all([
          fetchProviders(supabase),
          fetchReports(supabase),
        ]);
        if (cancelled) return;

        if (nextProviders.length > 0) setProviderRows(nextProviders);
        if (nextReports.length > 0) setSeedReports(nextReports);

        setDataStatus(
          nextReports.length > 0 || nextProviders.length > 0
            ? "지금 들어온 제보를 순서대로 보여드리고 있어요."
            : "아직 등록된 소식이 많지 않아 첫 제보를 기다리고 있어요.",
        );
      } catch {
        if (!cancelled) {
          setDataStatus(
            "연결이 잠시 불안정해 예시 화면으로 보여드리고 있어요.",
          );
        }
      }
    }

    void hydrateFromSupabase();
    return () => {
      cancelled = true;
    };
  }, []);

  /* ── derived values ── */
  const deferredDistrict = useDeferredValue(selectedDistrict);
  const providerCatalog =
    providerRows.length > 0 ? providerRows : initialProviders;
  const baseReports = seedReports.length > 0 ? seedReports : initialReports;
  const reports = [...userReports, ...baseReports].sort(
    (a, b) =>
      new Date(b.reportedAt).getTime() - new Date(a.reportedAt).getTime(),
  );
  const subscriptions = [...userSubscriptions, ...initialSubscriptions];
  const visibleReports =
    deferredDistrict === "all"
      ? reports
      : reports.filter((r) => r.district === deferredDistrict);
  const districtCounts = DISTRICTS.reduce<Record<string, number>>(
    (acc, d) => {
      acc[d] = d === "all" ? reports.length : reports.filter((r) => r.district === d).length;
      return acc;
    },
    {},
  );
  const pulseRows = buildNeighborhoodPulse(visibleReports);
  const latestVisibleReport = visibleReports[0] ?? null;
  const photoCount = visibleReports.filter((r) => r.hasPhoto).length;
  const averageTrust = visibleReports.length
    ? Math.round(
        visibleReports.reduce((sum, r) => sum + r.trustScore, 0) /
          visibleReports.length,
      )
    : 0;
  const supabaseLabel = !hasSupabaseEnv
    ? "시범 화면"
    : dataStatus.includes("순서대로")
      ? "실시간 소식"
      : dataStatus.includes("불안정")
        ? "예시 화면"
        : "불러오는 중";

  /* ── callbacks ── */
  function handleReportSaved(report: Report) {
    startTransition(() => {
      setUserReports((prev) => [report, ...prev]);
      setSelectedDistrict(report.district);
    });
  }

  function handleSubscriptionSaved(subscription: AlertSubscription) {
    startTransition(() => {
      setUserSubscriptions((prev) => [subscription, ...prev]);
    });
  }

  return (
    <main id="main-content" className="page-shell">
      <Hero
        reportCount={reports.length}
        districtCount={new Set(reports.map((r) => r.district)).size}
        providerCount={providerCatalog.length}
        subscriptionCount={subscriptions.length}
        supabaseLabel={supabaseLabel}
        dataStatus={dataStatus}
      />

      <ReportFeed
        districts={DISTRICTS}
        selectedDistrict={selectedDistrict}
        onDistrictChange={setSelectedDistrict}
        districtCounts={districtCounts}
        visibleReports={visibleReports}
        providerCatalog={providerCatalog}
        photoCount={photoCount}
        averageTrust={averageTrust}
        latestVisibleReport={latestVisibleReport}
      />

      <PulseSection pulseRows={pulseRows} />

      <ReportFormSection
        providerCatalog={providerCatalog}
        onReportSaved={handleReportSaved}
        existingUserReports={userReports}
      />

      <AlertFormSection
        subscriptions={subscriptions}
        onSubscriptionSaved={handleSubscriptionSaved}
        existingUserSubscriptions={userSubscriptions}
        hasSupabaseEnv={hasSupabaseEnv}
      />

      <ProviderSection providers={providerCatalog} />

      <QuickReportFab />
    </main>
  );
}
