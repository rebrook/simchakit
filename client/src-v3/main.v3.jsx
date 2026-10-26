import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import "./App.css";
import AppV3 from "./App.v3.jsx";
import { redactRsvpPath } from "@/utils/rsvpToken.js";

// Guest RSVP links (/r/<token>) carry a private token: keep it out of analytics.
const scrubUrl = (event) => ({
  ...event,
  url: redactRsvpPath(event.url),
  ...(event.route ? { route: redactRsvpPath(event.route) } : {}),
});

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <AppV3 />
    <Analytics beforeSend={scrubUrl} />
    <SpeedInsights beforeSend={scrubUrl} />
  </StrictMode>
);
