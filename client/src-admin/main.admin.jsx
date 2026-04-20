import { StrictMode } from "react";
import { createRoot }  from "react-dom/client";
import AppAdmin        from "./App.admin.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <AppAdmin />
  </StrictMode>
);
