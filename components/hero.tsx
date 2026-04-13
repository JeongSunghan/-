type HeroProps = {
  reportCount: number;
  districtCount: number;
  providerCount: number;
  subscriptionCount: number;
  supabaseLabel: string;
  dataStatus: string;
};

export default function Hero({
  reportCount,
  districtCount,
  providerCount,
  subscriptionCount,
  supabaseLabel,
  dataStatus,
}: HeroProps) {
  return (
    <header className="hero surface">
      <div className="topbar">
        <div className="brand-lockup">
          <p className="eyebrow">우리 동네 칼갈이</p>
          <h1>칼갈이 트럭, 오늘 우리 동네에 왔는지 바로 확인하세요</h1>
        </div>
        <div className="pill-row">
          <span className="pill">{supabaseLabel}</span>
          <span className="pill pill-muted">수원 중심</span>
          <span className="pill pill-muted">동네 알림</span>
        </div>
      </div>

      <div className="hero-grid">
        <div className="hero-copy-column">
          <p className="hero-kicker">수원에서 먼저 시작하는 동네 제보 서비스</p>
          <p className="hero-copy">
            시장 앞이나 주민센터 근처에 잠깐 들르는 칼갈이 트럭은 놓치기 쉽습니다.
            본 사람이 알려주고, 필요한 사람은 바로 확인하고, 다음 방문도 알림으로
            챙길 수 있게 만든 화면입니다.
          </p>
          <div className="cta-row">
            <a className="button button-primary" href="#report-form">
              지금 본 곳 알려주기
            </a>
            <a className="button button-secondary" href="#subscription-form">
              우리 동네 알림 받기
            </a>
          </div>
          <div className="signal-strip" aria-label="서비스 핵심 흐름">
            <article className="signal-step">
              <span className="signal-index">01</span>
              <strong>본 사람이 알려요</strong>
              <p>어디에서 봤는지 간단히 적으면 바로 동네 소식이 됩니다.</p>
            </article>
            <article className="signal-step">
              <span className="signal-index">02</span>
              <strong>근처 소식을 봐요</strong>
              <p>방금 올라온 제보를 보고 헛걸음을 줄일 수 있어요.</p>
            </article>
            <article className="signal-step">
              <span className="signal-index">03</span>
              <strong>다음 방문도 챙겨요</strong>
              <p>자주 가는 동네는 저장해 두고 다시 왔을 때 놓치지 않아요.</p>
            </article>
          </div>
        </div>

        <div className="stat-grid">
          <article className="stat-card">
            <span>오늘 올라온 소식</span>
            <strong>{reportCount}</strong>
          </article>
          <article className="stat-card">
            <span>둘러볼 수 있는 지역</span>
            <strong>{districtCount}</strong>
          </article>
          <article className="stat-card">
            <span>함께 보는 장인</span>
            <strong>{providerCount}</strong>
          </article>
          <article className="stat-card">
            <span>알림 요청</span>
            <strong>{subscriptionCount}</strong>
          </article>
        </div>
      </div>
      <p className="status-text" role="status" aria-live="polite">
        {dataStatus}
      </p>
    </header>
  );
}
