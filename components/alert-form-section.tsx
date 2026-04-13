"use client";

import { startTransition, useState, type FormEvent } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { insertAlertSubscription } from "@/lib/supabase/repository";
import { writeLocalRows, STORAGE_KEYS } from "@/lib/storage";
import type { AlertSubscription, District } from "@/lib/types";

const DISTRICTS: District[] = ["장안구", "권선구", "팔달구", "영통구"];

type AlertFormSectionProps = {
  subscriptions: AlertSubscription[];
  onSubscriptionSaved: (subscription: AlertSubscription) => void;
  existingUserSubscriptions: AlertSubscription[];
  hasSupabaseEnv: boolean;
};

export default function AlertFormSection({
  subscriptions,
  onSubscriptionSaved,
  existingUserSubscriptions,
  hasSupabaseEnv,
}: AlertFormSectionProps) {
  const [subscriptionStatus, setSubscriptionStatus] = useState(
    hasSupabaseEnv
      ? "원하는 동네를 저장해 두면 다음 소식을 더 빨리 확인할 수 있어요."
      : "지금은 이 기기에만 알림 설정이 저장됩니다.",
  );
  const [latestSubscription, setLatestSubscription] =
    useState<AlertSubscription | null>(existingUserSubscriptions[0] ?? null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = event.currentTarget;
    const formData = new FormData(form);
    const draftSubscription: AlertSubscription = {
      id: `alert-${Date.now()}`,
      district: formData.get("district") as District,
      anchorNeighborhood: String(
        formData.get("anchorNeighborhood") ?? "",
      ).trim(),
      radiusMeters: Number(formData.get("radiusMeters") ?? 1000),
      channel: formData.get("channel") as AlertSubscription["channel"],
      nickname: String(formData.get("nickname") ?? "").trim() || undefined,
      note: String(formData.get("note") ?? "").trim() || undefined,
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
        setSubscriptionStatus(
          "알림 설정을 저장했어요. 다음 소식을 더 빨리 확인할 수 있어요.",
        );
      } catch {
        setSubscriptionStatus(
          "연결이 잠시 불안정해도 이 기기에는 알림 설정을 남겨뒀어요.",
        );
      }
    } else {
      setSubscriptionStatus("지금은 이 기기에 알림 설정을 저장했어요.");
    }

    startTransition(() => {
      const nextRows = [nextSubscription, ...existingUserSubscriptions];
      writeLocalRows(STORAGE_KEYS.alerts, nextRows);
      setLatestSubscription(nextSubscription);
      onSubscriptionSaved(nextSubscription);
    });

    form.reset();
  }

  return (
    <section className="section surface duo-grid">
      <form
        id="subscription-form"
        className="form-panel"
        onSubmit={handleSubmit}
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
              {DISTRICTS.map((district) => (
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
            ? latestSubscription.nickname ||
              `${latestSubscription.district} 알림`
            : "아직 저장한 알림이 없어요"}
        </h2>
        <div className="metric-list">
          <div>
            <span>반경</span>
            <strong>
              {latestSubscription
                ? `${latestSubscription.radiusMeters}m`
                : "-"}
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
                  {subscription.nickname ||
                    `${subscription.district} 알림`}
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
  );
}
