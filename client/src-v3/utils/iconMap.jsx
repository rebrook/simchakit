// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit V4.0.0 — iconMap.js
// Centralized icon map: string key → Lucide component.
// All icons render via <Icon name="key" context="nav|button|..." />.
// Color is always inherited via currentColor — never set inline.
// ─────────────────────────────────────────────────────────────────────────────

import {
  LayoutDashboard,
  Users,
  UserRound,
  Wallet,
  Store,
  CircleCheckBig,
  BookOpen,
  ScrollText,
  Armchair,
  Gift,
  Luggage,
  Star,
  Calendar,
  Search,
  Settings,
  Printer,
  Plus,
  ArrowLeft,
  ArrowRight,
  X,
  MoreHorizontal,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Check,
  Sun,
  Moon,
  Monitor,
  AlertTriangle,
  Lock,
  ClipboardList,
  Sparkles,
  Sparkle,
  BarChart3,
  LogOut,
  Eye,
  Pencil,
  Crown,
  Pin,
  Hand,
  ExternalLink,
  Lightbulb,
  ShieldCheck,
  Bug,
  Map,
  Clock,
  Hash,
  Rocket,
  Hammer,
  Telescope,
  Phone,
  Mail,
  MailCheck,
  MailX,
  Globe,
  MapPin,
  Hotel,
  FileText,
  BellRing,
  GripVertical,
  Target,
  Banknote,
  CalendarCheck,
  List,
  Download,
  Link,
  Snowflake,
  Info,
  PartyPopper,
  Wand2,
} from "lucide-react";

// ── String key → Lucide component ───────────────────────────────────────────
export const ICONS = {
  // Tab icons (match tab IDs)
  overview:        LayoutDashboard,
  guests:          Users,
  budget:          Wallet,
  vendors:         Store,
  tasks:           CircleCheckBig,
  prep:            BookOpen,
  ceremony:        ScrollText,
  seating:         Armchair,
  gifts:           Gift,
  accommodations:  Luggage,
  favors:          Star,
  calendar:        Calendar,

  // Search group
  people:          UserRound,

  // Header actions
  search:          Search,
  settings:        Settings,
  printer:         Printer,
  plus:            Plus,
  arrowLeft:       ArrowLeft,
  arrowRight:      ArrowRight,
  x:               X,
  moreHorizontal:  MoreHorizontal,
  chevronRight:    ChevronRight,
  chevronDown:     ChevronDown,
  check:           Check,

  // Theme switcher
  sun:             Sun,
  moon:            Moon,
  monitor:         Monitor,

  // Status / banners
  alertTriangle:   AlertTriangle,
  lock:            Lock,
  eye:             Eye,
  pencil:          Pencil,
  crown:           Crown,
  pin:             Pin,

  // Menu items / overlays
  clipboardList:   ClipboardList,
  sparkles:        Sparkles,
  barChart3:       BarChart3,
  logOut:          LogOut,
  bookOpen:        BookOpen,
  externalLink:    ExternalLink,
  hand:            Hand,

  // Guide sections
  gettingStarted:  Sparkle,
  tips:            Lightbulb,
  admin:           ShieldCheck,
  dayof:           ClipboardList,
  activitylog:     BarChart3,

  // WhatsNew / roadmap
  bug:             Bug,
  map:             Map,
  clock:           Clock,
  hash:            Hash,
  rocket:          Rocket,
  hammer:          Hammer,
  telescope:       Telescope,

  // Contact / inline data
  phone:           Phone,
  mail:            Mail,
  mailCheck:       MailCheck,
  mailX:           MailX,
  globe:           Globe,
  mapPin:          MapPin,
  hotel:           Hotel,
  fileText:        FileText,
  bellRing:        BellRing,
  grip:            GripVertical,
  target:          Target,
  banknote:        Banknote,
  calendarCheck:   CalendarCheck,
  list:            List,
  download:        Download,
  link:            Link,
  snowflake:       Snowflake,
  info:            Info,
  partyPopper:     PartyPopper,
  wand:            Wand2,
  chevronUp:       ChevronUp,
};

// ── Context presets ─────────────────────────────────────────────────────────
// strokeWidth is in SVG viewBox units (24×24). A fixed width renders
// different on-screen weight at every size, so we tune per context to
// hold the visual stroke at roughly 1.5px on screen.
const PRESET = {
  nav:       { size: 18, strokeWidth: 2 },      // desktop top-bar tab (icon + label)
  navMobile: { size: 22, strokeWidth: 1.75 },   // mobile bottom-bar tab
  button:    { size: 20, strokeWidth: 1.75 },    // icon-only header button
  menu:      { size: 18, strokeWidth: 2 },       // drawer / overflow row
  inline:    { size: 15, strokeWidth: 2.25 },    // icon punctuating data
  badge:     { size: 14, strokeWidth: 2.5 },     // icon inside a small role pill
  alert:     { size: 18, strokeWidth: 2 },       // start of a warning line
  empty:     { size: 44, strokeWidth: 1.25 },    // large centered empty-state
};

// ── Icon component ──────────────────────────────────────────────────────────
// Usage: <Icon name="guests" context="nav" />
//        <Icon name="x" context="button" className="my-class" />
//
// - color is always currentColor (inherited from parent CSS)
// - size and strokeWidth can be overridden per call site if needed
export function Icon({ name, context = "button", size, strokeWidth, style, ...rest }) {
  const C = ICONS[name];
  if (!C) {
    console.warn(`[Icon] Unknown icon key: "${name}"`);
    return null;
  }
  const p = PRESET[context] || PRESET.button;
  return (
    <C
      size={size ?? p.size}
      strokeWidth={strokeWidth ?? p.strokeWidth}
      style={{ display: "inline-block", verticalAlign: "middle", flexShrink: 0, ...style }}
      {...rest}
    />
  );
}
