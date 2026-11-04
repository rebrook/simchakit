// SimchaKit Admin: simple inline SVG icons (stroke follows the text color).

function Svg({ children }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
         strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {children}
    </svg>
  );
}

export const IconBriefing = () => (
  <Svg><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4V3h6v1" /><path d="m8.5 13 2.5 2.5 4.5-5" /></Svg>
);
export const IconDashboard = () => (
  <Svg><rect x="4" y="4" width="7" height="7" rx="1" /><rect x="13" y="4" width="7" height="7" rx="1" /><rect x="4" y="13" width="7" height="7" rx="1" /><rect x="13" y="13" width="7" height="7" rx="1" /></Svg>
);
export const IconUsers = () => (
  <Svg><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" /></Svg>
);
export const IconEvents = () => (
  <Svg><rect x="4" y="5" width="16" height="16" rx="2" /><path d="M8 3v4M16 3v4M4 10h16" /></Svg>
);
export const IconPurchases = () => (
  <Svg><rect x="3" y="6" width="18" height="13" rx="2" /><path d="M3 11h18M7 15h3" /></Svg>
);
export const IconCoupons = () => (
  <Svg><path d="M3 12V4h8l10 10-8 8L3 12Z" /><circle cx="7.5" cy="8.5" r="1" /></Svg>
);
export const IconMenu = () => (<Svg><path d="M4 7h16M4 12h16M4 17h16" /></Svg>);
export const IconClose = () => (<Svg><path d="M6 6l12 12M18 6 6 18" /></Svg>);
export const IconSun = () => (
  <Svg><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></Svg>
);
export const IconMoon = () => (<Svg><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5Z" /></Svg>);
export const IconSignOut = () => (
  <Svg><path d="M10 4H5v16h5M15 8l4 4-4 4M19 12H9" /></Svg>
);
