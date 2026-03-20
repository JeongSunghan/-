export type District = "장안구" | "권선구" | "팔달구" | "영통구";

export type Provider = {
  id: string;
  name: string;
  baseArea: string;
  truckLabel: string;
  mobileService: boolean;
  serviceTags: string[];
  serviceAreas: string[];
  priceHints: string[];
  intro: string;
};

export type Report = {
  id: string;
  district: District;
  neighborhood: string;
  place: string;
  truckType: string;
  providerId?: string;
  providerHint?: string;
  reportedAt: string;
  reportedLabel?: string;
  trustScore: number;
  status: "active" | "expired" | "blocked";
  hasPhoto: boolean;
  reporterAlias?: string;
  note?: string;
  lat?: number | null;
  lng?: number | null;
  sourceType: "seed_report" | "community_report" | "user_report";
};

export type AlertSubscription = {
  id: string;
  district: District;
  anchorNeighborhood: string;
  radiusMeters: number;
  channel: "웹 푸시" | "카카오 알림톡" | "문자";
  nickname?: string;
  note?: string;
  sourceType: "seed" | "user";
};
