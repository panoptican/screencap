import { type IpcMainInvokeEvent, ipcMain } from "electron";
import type { ZodType, ZodTypeDef } from "zod";
import type { IpcInvokeHandlers } from "../../shared/ipc";

let trustedWebContentsIds = new Set<number>();

export function setTrustedWebContentsIds(ids: Iterable<number>): void {
	trustedWebContentsIds = new Set(ids);
}

export function addTrustedWebContentsId(id: number): void {
	trustedWebContentsIds.add(id);
}

export function removeTrustedWebContentsId(id: number): void {
	trustedWebContentsIds.delete(id);
}

function assertTrustedSender(event: IpcMainInvokeEvent): void {
	if (!trustedWebContentsIds.has(event.sender.id)) {
		throw new Error("Unauthorized IPC sender");
	}
}

type MaybePromise<T> = T | Promise<T>;

export function secureHandle<C extends keyof IpcInvokeHandlers>(
	channel: C,
	argsSchema: ZodType<Parameters<IpcInvokeHandlers[C]>, ZodTypeDef, unknown[]>,
	handler: (
		...args: Parameters<IpcInvokeHandlers[C]>
	) => MaybePromise<ReturnType<IpcInvokeHandlers[C]>>,
): void {
	ipcMain.handle(channel, async (event, ...args: unknown[]) => {
		assertTrustedSender(event);
		const parsedArgs = argsSchema.parse(args) as Parameters<
			IpcInvokeHandlers[C]
		>;
		return await handler(...parsedArgs);
	});
}

export function secureHandleWithEvent<C extends keyof IpcInvokeHandlers>(
	channel: C,
	argsSchema: ZodType<Parameters<IpcInvokeHandlers[C]>, ZodTypeDef, unknown[]>,
	handler: (
		event: IpcMainInvokeEvent,
		...args: Parameters<IpcInvokeHandlers[C]>
	) => MaybePromise<ReturnType<IpcInvokeHandlers[C]>>,
): void {
	ipcMain.handle(channel, async (event, ...args: unknown[]) => {
		assertTrustedSender(event);
		const parsedArgs = argsSchema.parse(args) as Parameters<
			IpcInvokeHandlers[C]
		>;
		return await handler(event, ...parsedArgs);
	});
}
