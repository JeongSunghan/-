import type { PulseRow } from "@/lib/utils";

type PulseSectionProps = {
  pulseRows: PulseRow[];
};

export default function PulseSection({ pulseRows }: PulseSectionProps) {
  return (
    <section className="section surface">
      <div className="section-head">
        <div>
          <p className="eyebrow">많이 보이는 곳</p>
          <h2>요즘 소식이 자주 올라오는 동네</h2>
        </div>
      </div>
      <div className="info-grid">
        {pulseRows.length === 0 ? (
          <article className="empty-card">
            <h3>요약할 소식이 아직 없어요</h3>
            <p className="section-note">
              제보가 쌓이면 동네별 사진 수와 최고 신뢰도가 자동 집계됩니다.
            </p>
          </article>
        ) : (
          pulseRows.map((row) => (
            <article
              key={`${row.district}-${row.label}`}
              className="info-card"
            >
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
          ))
        )}
      </div>
    </section>
  );
}
