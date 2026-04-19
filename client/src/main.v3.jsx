import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./App.css";
import AppV3 from "./App.v3.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <AppV3 />
  </StrictMode>
);
