import React from 'react';

interface LogoProps {
  compact?: boolean;
}

export function Logo({ compact = false }: LogoProps) {
  return (
    <div className="inline-flex items-center gap-2.5 whitespace-nowrap shrink-0 select-none">
      <svg
        width="34"
        height="34"
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0 drop-shadow-[0_0_12px_var(--ms-accent-glow)]"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="msPlayOuter" x1="4" y1="4" x2="36" y2="36" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#00d4ff" />
            <stop offset="100%" stopColor="#1d63ff" />
          </linearGradient>
          <linearGradient id="msPlayInner" x1="12" y1="10" x2="30" y2="28" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#bae6fd" />
            <stop offset="100%" stopColor="#38bdf8" />
          </linearGradient>
        </defs>
        <path
          d="M9 7.2C9 4.8 11.6 3.3 13.7 4.5L34.2 16.3C36.3 17.5 36.3 20.5 34.2 21.7L13.7 33.5C11.6 34.7 9 33.2 9 30.8V7.2Z"
          stroke="url(#msPlayOuter)"
          strokeWidth="3"
          fill="rgba(0, 168, 255, 0.28)"
        />
        <path
          d="M15.5 13.4C15.5 12.1 16.9 11.3 18 12L27.8 17.6C28.9 18.2 28.9 19.8 27.8 20.4L18 26C16.9 26.7 15.5 25.9 15.5 24.6V13.4Z"
          fill="url(#msPlayInner)"
        />
      </svg>
      {!compact && (
        <span className="font-display text-xl font-extrabold tracking-tight text-white">
          Mega<span style={{ color: 'var(--ms-accent-bright)' }}>Stream</span>
        </span>
      )}
    </div>
  );
}
