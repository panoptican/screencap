export { bootstrap } from "./bootstrap";
export { getIsQuitting, performShutdown, setIsQuitting } from "./lifecycle";
export { destroyPopupWindow, togglePopupWindow } from "./popup";
export { createTray, destroyTray } from "./tray";
export {
	destroyMainWindow,
	getMainWindow,
	hideMainWindow,
	showMainWindow,
} from "./window";
