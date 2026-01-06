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

function parseRoute(): {
	kind: "main" | "streak" | "capture";
	param?: string;
} {
	if (hash === "#popup") return { kind: "streak" };
	if (hash.startsWith("#popup-capture")) return { kind: "capture" };
	return { kind: "main" };
}

const route = parseRoute();

try {
	function Root() {
		useSocialDirectoryBootstrap();

		if (route.kind === "streak") return <StreakPopup />;
		if (route.kind === "capture") return <ProjectProgressCapturePopup />;
		return <App />;
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
