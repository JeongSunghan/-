"use client";

import { useEffect, useRef, useState } from "react";
import {
  loadKakaoMaps,
  getKakaoMapsKey,
  SUWON_CENTER,
  type MarkerData,
} from "@/lib/kakao-maps";

/* eslint-disable @typescript-eslint/no-explicit-any */

type KakaoMapProps = {
  markers: MarkerData[];
  center?: { lat: number; lng: number };
  level?: number;
  /** 현재 위치 마커 */
  currentPosition?: { lat: number; lng: number } | null;
};

/** trust score → 마커 색상 */
function markerColor(score?: number): string {
  if (score === undefined) return "#47615b"; // provider: steel
  if (score >= 85) return "#216a49"; // high: ok green
  if (score >= 70) return "#9f611b"; // mid: warn amber
  return "#8c3d31"; // low: red
}

/** 간이 SVG 마커 이미지 URL 생성 */
function svgMarkerUrl(color: string, type: "report" | "provider"): string {
  const shape =
    type === "report"
      ? `<circle cx="14" cy="14" r="10" fill="${color}" stroke="#fff" stroke-width="2.5"/>`
      : `<rect x="4" y="4" width="20" height="20" rx="5" fill="${color}" stroke="#fff" stroke-width="2.5"/>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28">${shape}</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export default function KakaoMap({
  markers,
  center = SUWON_CENTER,
  level = 6,
  currentPosition,
}: KakaoMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markerRefs = useRef<any[]>([]);
  const infoWindowRef = useRef<any>(null);
  const currentPosMarkerRef = useRef<any>(null);
  const [sdkReady, setSdkReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasKey = Boolean(getKakaoMapsKey());

  /* ── SDK 로드 ── */
  useEffect(() => {
    if (!hasKey) {
      setError("NEXT_PUBLIC_KAKAO_JS_KEY가 설정되지 않아 지도를 표시할 수 없어요.");
      return;
    }

    loadKakaoMaps()
      .then(() => setSdkReady(true))
      .catch(() =>
        setError("카카오 지도 SDK를 불러오지 못했어요. 잠시 후 다시 시도해 주세요."),
      );
  }, [hasKey]);

  /* ── 지도 초기화 ── */
  useEffect(() => {
    if (!sdkReady || !containerRef.current) return;

    const kakao = window.kakao.maps;
    const mapCenter = new kakao.LatLng(center.lat, center.lng);

    if (!mapRef.current) {
      mapRef.current = new kakao.Map(containerRef.current, {
        center: mapCenter,
        level,
      });
    } else {
      mapRef.current.setCenter(mapCenter);
      mapRef.current.setLevel(level);
    }
  }, [sdkReady, center.lat, center.lng, level]);

  /* ── 마커 갱신 ── */
  useEffect(() => {
    if (!sdkReady || !mapRef.current) return;

    const kakao = window.kakao.maps;
    const map = mapRef.current;

    // 기존 마커 제거
    markerRefs.current.forEach((m) => m.setMap(null));
    markerRefs.current = [];
    if (infoWindowRef.current) {
      infoWindowRef.current.close();
      infoWindowRef.current = null;
    }

    markers.forEach((data) => {
      const position = new kakao.LatLng(data.lat, data.lng);
      const imageUrl = svgMarkerUrl(
        markerColor(data.trustScore),
        data.type,
      );
      const imageSize = new kakao.Size(28, 28);
      const imageOption = { offset: new kakao.Point(14, 14) };
      const markerImage = new kakao.MarkerImage(
        imageUrl,
        imageSize,
        imageOption,
      );

      const marker = new kakao.Marker({ position, image: markerImage });
      marker.setMap(map);

      // 클릭 시 인포윈도우
      kakao.event.addListener(marker, "click", () => {
        if (infoWindowRef.current) infoWindowRef.current.close();

        const trustHtml =
          data.trustScore !== undefined
            ? `<span style="color:${markerColor(data.trustScore)};font-weight:700">확인도 ${data.trustScore}</span>`
            : "";

        const iw = new kakao.InfoWindow({
          content: `<div style="padding:8px 12px;font-size:13px;line-height:1.5;max-width:220px;word-break:keep-all">
            <strong>${data.label}</strong><br/>
            ${trustHtml}
          </div>`,
        });
        iw.open(map, marker);
        infoWindowRef.current = iw;
      });

      markerRefs.current.push(marker);
    });

    // 마커가 있으면 bounds에 맞춤
    if (markers.length > 0) {
      const bounds = new kakao.LatLngBounds();
      markers.forEach((d) => bounds.extend(new kakao.LatLng(d.lat, d.lng)));
      map.setBounds(bounds, 60);
    }
  }, [sdkReady, markers]);

  /* ── 현재 위치 마커 ── */
  useEffect(() => {
    if (!sdkReady || !mapRef.current) return;

    const kakao = window.kakao.maps;

    if (currentPosMarkerRef.current) {
      currentPosMarkerRef.current.setMap(null);
      currentPosMarkerRef.current = null;
    }

    if (!currentPosition) return;

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20">
      <circle cx="10" cy="10" r="7" fill="#4285F4" stroke="#fff" stroke-width="2.5"/>
    </svg>`;

    const marker = new kakao.Marker({
      position: new kakao.LatLng(currentPosition.lat, currentPosition.lng),
      image: new kakao.MarkerImage(
        `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
        new kakao.Size(20, 20),
        { offset: new kakao.Point(10, 10) },
      ),
    });
    marker.setMap(mapRef.current);
    currentPosMarkerRef.current = marker;
  }, [sdkReady, currentPosition]);

  /* ── 키 없거나 에러 시 fallback ── */
  if (error || !hasKey) {
    return (
      <div className="map-container map-fallback">
        <p>{error || "카카오 지도 API 키가 설정되면 이곳에 지도가 표시됩니다."}</p>
      </div>
    );
  }

  return (
    <div className="map-container">
      <div ref={containerRef} className="map-canvas" />
      {!sdkReady && (
        <div className="map-loading">지도를 불러오는 중…</div>
      )}
    </div>
  );
}
