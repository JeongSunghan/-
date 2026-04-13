/**
 * Kakao Maps JS SDK dynamic loader.
 *
 * Loads the script once and resolves with the `kakao.maps` namespace.
 * If `NEXT_PUBLIC_KAKAO_JS_KEY` is missing the promise rejects immediately.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    kakao: any;
  }
}

const SCRIPT_ID = "kakao-maps-sdk";

let loadPromise: Promise<any> | null = null;

export function getKakaoMapsKey(): string | undefined {
  return process.env.NEXT_PUBLIC_KAKAO_JS_KEY ?? undefined;
}

export function loadKakaoMaps(): Promise<typeof window.kakao.maps> {
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    const appKey = getKakaoMapsKey();
    if (!appKey) {
      reject(new Error("NEXT_PUBLIC_KAKAO_JS_KEY is not set"));
      loadPromise = null;
      return;
    }

    // already loaded
    if (window.kakao?.maps?.Map) {
      resolve(window.kakao.maps);
      return;
    }

    // already has script tag but not yet loaded
    if (document.getElementById(SCRIPT_ID)) {
      const check = setInterval(() => {
        if (window.kakao?.maps?.Map) {
          clearInterval(check);
          resolve(window.kakao.maps);
        }
      }, 50);
      return;
    }

    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.src = `//dapi.kakao.com/v2/maps/sdk.js?appkey=${appKey}&autoload=false`;
    script.async = true;

    script.onload = () => {
      window.kakao.maps.load(() => {
        resolve(window.kakao.maps);
      });
    };

    script.onerror = () => {
      loadPromise = null;
      reject(new Error("Failed to load Kakao Maps SDK"));
    };

    document.head.appendChild(script);
  });

  return loadPromise;
}

/* ── Marker helpers ── */

/** Suwon city center (수원시청 부근) */
export const SUWON_CENTER = { lat: 37.2636, lng: 127.0286 };

export type MarkerData = {
  id: string;
  lat: number;
  lng: number;
  label: string;
  type: "report" | "provider";
  trustScore?: number;
};
