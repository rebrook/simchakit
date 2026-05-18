import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Analytics } from "@vercel/analytics/react";
import "./App.css";
import AppV3 from "./App.v3.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <AppV3 />
    <Analytics />
  </StrictMode>
);
