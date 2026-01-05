import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { FpsGuard } from "./components/performance/FpsGuard";
import { ProjectProgressCapturePopup } from "./components/popup/ProjectProgressCapturePopup";
import { StreakPopup } from "./components/popup/StreakPopup";
import { useSocialDirectoryBootstrap } from "./hooks/useSocialDirectoryBootstrap";
import { initRendererLogCapture } from "./lib/rendererLogBuffer";
import "./styles/globals.css";

initRendererLogCapture();

const rootElement = document.getElementById("root")!;
const hash = window.location.hash;
const popupKind =
	hash === "#popup"
		? "streak"
		: hash.startsWith("#popup-capture")
			? "capture"
			: null;

try {
	function Root() {
		useSocialDirectoryBootstrap();
		return popupKind === "streak" ? (
			<StreakPopup />
		) : popupKind === "capture" ? (
			<ProjectProgressCapturePopup />
		) : (
			<App />
		);
	}

	ReactDOM.createRoot(rootElement).render(
		<React.StrictMode>
			<FpsGuard />
			<Root />
		</React.StrictMode>,
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
