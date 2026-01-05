import { getBackendUrl } from "../../infra/settings/BackendConfig";

export function getPublishBaseUrl(): string {
	return getBackendUrl();
}

export const PUBLISH_BASE_URL = "https://screencap-frontend.vercel.app";
