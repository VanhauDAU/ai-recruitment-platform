export default function AuthFormStyles() {
  return (
    <style>{`
      @keyframes fadeSlideUp {
        from { opacity: 0; transform: translateY(18px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      @keyframes fadeIn {
        from { opacity: 0; }
        to   { opacity: 1; }
      }
      .login-card { animation: fadeSlideUp 0.45s cubic-bezier(0.22,1,0.36,1) both; }
      .login-field { animation: fadeSlideUp 0.45s cubic-bezier(0.22,1,0.36,1) both; }
      .login-field:nth-child(1) { animation-delay: 0.05s; }
      .login-field:nth-child(2) { animation-delay: 0.1s; }
      .login-field:nth-child(3) { animation-delay: 0.15s; }
      .login-field:nth-child(4) { animation-delay: 0.2s; }
      .social-btn { transition: all 0.18s ease; }
      .social-btn:hover { transform: translateY(-2px); box-shadow: 0 4px 16px rgba(0,0,0,0.08); }
      .submit-btn {
        position: relative; overflow: hidden;
        background: linear-gradient(135deg, var(--brand-primary) 0%, var(--brand-primary-hover) 100%);
        isolation: isolate;
        transition: transform 0.16s ease, box-shadow 0.2s ease, opacity 0.2s ease;
      }
      .submit-btn:not(:disabled):hover {
        transform: translateY(-1px);
        box-shadow: 0 8px 24px color-mix(in srgb, var(--brand-primary) 35%, transparent);
      }
      .submit-btn:not(:disabled):active {
        transform: translateY(0) scale(0.985);
        box-shadow: 0 3px 10px color-mix(in srgb, var(--brand-primary) 24%, transparent);
      }
      .submit-btn:disabled {
        pointer-events: none;
        opacity: 0.72;
      }
      .submit-btn::after {
        content: ''; position: absolute; inset: 0;
        background: linear-gradient(135deg, rgba(255,255,255,0.12) 0%, transparent 60%);
        pointer-events: none;
      }
      .submit-btn__track {
        position: relative;
        z-index: 1;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        transition:
          opacity 0.6s cubic-bezier(0.15,0.85,0.31,1),
          transform 0.8s cubic-bezier(0.15,0.85,0.31,1);
      }
      .submit-btn__label {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 0.625rem;
        white-space: nowrap;
        transition:
          opacity 0.6s cubic-bezier(0.15,0.85,0.31,1),
          transform 0.8s cubic-bezier(0.15,0.85,0.31,1);
      }
      .submit-btn__label--clone {
        position: absolute;
        left: 50%;
        top: 50%;
        width: max-content;
        opacity: 0;
        transform: translate(-50%, 80%);
      }
      .submit-btn:not(:disabled):hover .submit-btn__track {
        transform: translateY(-150%);
      }
      .submit-btn:not(:disabled):hover .submit-btn__label:first-child {
        opacity: 0;
      }
      .submit-btn:not(:disabled):hover .submit-btn__label--clone {
        opacity: 1;
        transform: translate(-50%, 100%);
      }
      .submit-btn__loading {
        position: relative;
        z-index: 1;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 0.625rem;
      }
      @media (prefers-reduced-motion: reduce) {
        .submit-btn,
        .submit-btn__track,
        .submit-btn__label {
          transition-duration: 0.01ms !important;
        }
        .submit-btn:not(:disabled):hover,
        .submit-btn:not(:disabled):hover .submit-btn__track {
          transform: none;
        }
        .submit-btn__label--clone {
          display: none;
        }
        .submit-btn:not(:disabled):hover .submit-btn__label:first-child {
          opacity: 1;
        }
      }
      .divider-line { flex: 1; height: 1px; background: linear-gradient(to right, transparent, #e5e7eb, transparent); }
    `}</style>
  )
}
