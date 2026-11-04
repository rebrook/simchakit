import { StrictMode } from "react";
import { createRoot }  from "react-dom/client";
import AppAdmin        from "./App.admin.jsx";
import { applyStoredTheme } from "./hooks/useAdminTheme.js";
import "./admin.css";

applyStoredTheme();

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <AppAdmin />
  </StrictMode>
);
