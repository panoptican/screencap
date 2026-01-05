import { getBackendUrl } from "../../infra/settings/BackendConfig";

export function getSocialApiBaseUrl(): string {
	return getBackendUrl();
}

export const SOCIAL_API_BASE_URL = "https://screencap-frontend.vercel.app";
