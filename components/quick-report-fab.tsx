"use client";

export default function QuickReportFab() {
  function scrollToForm() {
    const form = document.getElementById("report-form");
    if (form) {
      form.scrollIntoView({ behavior: "smooth", block: "start" });
      const firstInput = form.querySelector<HTMLSelectElement>("select[name='district']");
      if (firstInput) {
        setTimeout(() => firstInput.focus(), 400);
      }
    }
  }

  return (
    <button
      type="button"
      className="fab"
      aria-label="빠른 제보"
      onClick={scrollToForm}
    >
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M12 5v14M5 12h14" />
      </svg>
      <span className="fab-label">제보</span>
    </button>
  );
}
