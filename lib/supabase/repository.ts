import type { SupabaseClient } from "@supabase/supabase-js";
import type { AlertSubscription, District, Provider, Report } from "@/lib/types";

type ProviderRow = {
  id: string;
  name: string;
  base_area: string | null;
  truck_label: string | null;
  mobile_service: boolean;
  service_tags: string[] | null;
  service_areas: string[] | null;
  price_hints: string[] | null;
  intro: string | null;
};

type ReportRow = {
  id: string;
  district: string;
  neighborhood: string;
  place: string;
  truck_type: string;
  provider_id: string | null;
  provider_hint: string | null;
  reported_at: string;
  trust_score: number;
  status: Report["status"];
  has_photo: boolean;
  reporter_alias: string | null;
  note: string | null;
  lat: number | null;
  lng: number | null;
  source_type: Report["sourceType"];
};

type AlertSubscriptionRow = {
  id: string;
  district: string;
  anchor_neighborhood: string;
  radius_meters: number;
  channel: AlertSubscription["channel"];
  nickname: string | null;
  note: string | null;
};

type ReportInsertInput = {
  district: District;
  neighborhood: string;
  place: string;
  truckType: string;
  providerId?: string;
  providerHint?: string;
  note?: string;
  reporterAlias?: string;
  lat?: number | null;
  lng?: number | null;
  hasPhoto: boolean;
  trustScore: number;
  status: Report["status"];
  sourceType: Report["sourceType"];
};

type AlertSubscriptionInsertInput = {
  district: District;
  anchorNeighborhood: string;
  radiusMeters: number;
  channel: AlertSubscription["channel"];
  nickname?: string;
  note?: string;
};

function normalizeStringArray(value: string[] | null | undefined) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function mapProvider(row: ProviderRow): Provider {
  return {
    id: row.id,
    name: row.name,
    baseArea: row.base_area ?? "",
    truckLabel: row.truck_label ?? "",
    mobileService: row.mobile_service,
    serviceTags: normalizeStringArray(row.service_tags),
    serviceAreas: normalizeStringArray(row.service_areas),
    priceHints: normalizeStringArray(row.price_hints),
    intro: row.intro ?? "",
  };
}

function mapReport(row: ReportRow): Report {
  return {
    id: row.id,
    district: row.district as District,
    neighborhood: row.neighborhood,
    place: row.place,
    truckType: row.truck_type,
    providerId: row.provider_id ?? undefined,
    providerHint: row.provider_hint ?? undefined,
    reportedAt: row.reported_at,
    trustScore: row.trust_score,
    status: row.status,
    hasPhoto: row.has_photo,
    reporterAlias: row.reporter_alias ?? undefined,
    note: row.note ?? undefined,
    lat: row.lat,
    lng: row.lng,
    sourceType: row.source_type,
  };
}

function mapAlertSubscription(row: AlertSubscriptionRow): AlertSubscription {
  return {
    id: row.id,
    district: row.district as District,
    anchorNeighborhood: row.anchor_neighborhood,
    radiusMeters: row.radius_meters,
    channel: row.channel,
    nickname: row.nickname ?? undefined,
    note: row.note ?? undefined,
    sourceType: "user",
  };
}

export async function fetchProviders(client: SupabaseClient) {
  const { data, error } = await client
    .from("providers")
    .select(
      "id, name, base_area, truck_label, mobile_service, service_tags, service_areas, price_hints, intro"
    )
    .order("updated_at", { ascending: false })
    .limit(24);

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => mapProvider(row as ProviderRow));
}

export async function fetchReports(client: SupabaseClient) {
  const { data, error } = await client
    .from("reports")
    .select(
      "id, district, neighborhood, place, truck_type, provider_id, provider_hint, reported_at, trust_score, status, has_photo, reporter_alias, note, lat, lng, source_type"
    )
    .eq("status", "active")
    .order("reported_at", { ascending: false })
    .limit(40);

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => mapReport(row as ReportRow));
}

export async function insertReport(
  client: SupabaseClient,
  input: ReportInsertInput
) {
  const { data, error } = await client
    .from("reports")
    .insert({
      district: input.district,
      neighborhood: input.neighborhood,
      place: input.place,
      truck_type: input.truckType,
      provider_id: input.providerId ?? null,
      provider_hint: input.providerHint ?? null,
      note: input.note ?? null,
      reporter_alias: input.reporterAlias ?? null,
      lat: input.lat ?? null,
      lng: input.lng ?? null,
      has_photo: input.hasPhoto,
      trust_score: input.trustScore,
      status: input.status,
      source_type: input.sourceType,
    })
    .select(
      "id, district, neighborhood, place, truck_type, provider_id, provider_hint, reported_at, trust_score, status, has_photo, reporter_alias, note, lat, lng, source_type"
    )
    .single();

  if (error) {
    throw error;
  }

  return mapReport(data as ReportRow);
}

export async function insertAlertSubscription(
  client: SupabaseClient,
  input: AlertSubscriptionInsertInput
) {
  const { data, error } = await client
    .from("alert_subscriptions")
    .insert({
      district: input.district,
      anchor_neighborhood: input.anchorNeighborhood,
      radius_meters: input.radiusMeters,
      channel: input.channel,
      nickname: input.nickname ?? null,
      note: input.note ?? null,
    })
    .select("id, district, anchor_neighborhood, radius_meters, channel, nickname, note")
    .single();

  if (error) {
    throw error;
  }

  return mapAlertSubscription(data as AlertSubscriptionRow);
}
