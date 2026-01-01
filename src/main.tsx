import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { TrayPopup } from "./components/TrayPopup";
import "./styles/globals.css";

const rootElement = document.getElementById("root")!;
const isPopup = window.location.hash === "#popup";

try {
	ReactDOM.createRoot(rootElement).render(
		<React.StrictMode>{isPopup ? <TrayPopup /> : <App />}</React.StrictMode>,
	);
} catch (error) {
	console.error("Failed to render app:", error);
	rootElement.innerHTML = `
    <div style="color: white; padding: 20px; font-family: system-ui;">
      <h1>Error loading app</h1>
      <pre>${error}</pre>
    </div>
  `;
}
