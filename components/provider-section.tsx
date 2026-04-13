import type { Provider } from "@/lib/types";

type ProviderSectionProps = {
  providers: Provider[];
};

export default function ProviderSection({ providers }: ProviderSectionProps) {
  return (
    <section className="section surface">
      <div className="section-head">
        <div>
          <p className="eyebrow">함께 보는 장인 정보</p>
          <h2>주변에서 활동하는 칼갈이 장인</h2>
        </div>
        <p className="section-note">
          정식 등록 전이라도 기본 정보는 함께 볼 수 있게 정리해 두었어요.
        </p>
      </div>
      <div className="provider-grid">
        {providers.length === 0 ? (
          <article className="empty-card">
            <h3>아직 공개된 장인 정보가 많지 않아요</h3>
            <p className="section-note">
              확인된 장인 정보가 늘어나면 이곳에서 한눈에 살펴볼 수 있어요.
            </p>
          </article>
        ) : (
          providers.map((provider) => (
            <article key={provider.id} className="provider-card">
              <div className="provider-top">
                <div>
                  <p className="eyebrow">{provider.baseArea}</p>
                  <h3>{provider.name}</h3>
                </div>
                <span className="pill pill-muted">
                  {provider.mobileService ? "출장 가능" : "방문형"}
                </span>
              </div>
              <p className="section-note">{provider.intro}</p>
              <div className="tag-row">
                {provider.serviceTags.map((tag) => (
                  <span key={tag} className="tag">
                    {tag}
                  </span>
                ))}
              </div>
              <div className="metric-list">
                <div>
                  <span>활동 지역</span>
                  <strong>{provider.serviceAreas.join(", ")}</strong>
                </div>
                <div>
                  <span>가격 참고</span>
                  <strong>{provider.priceHints.join(", ")}</strong>
                </div>
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
