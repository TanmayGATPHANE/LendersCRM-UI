import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
// Icon font: Phosphor (the app's single icon set, all weights regular).
import "@phosphor-icons/web/regular";
import "./index.css";

// Mount the app. All routing lives in App.jsx.
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);