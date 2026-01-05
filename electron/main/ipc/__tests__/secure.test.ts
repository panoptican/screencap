import { beforeEach, describe, expect, it, vi } from "vitest";
import { IpcChannels } from "../../../shared/ipc";
import { ipcCopyImageArgs } from "../validation";

const handlers = new Map<
	string,
	(event: { sender: { id: number } }, ...args: unknown[]) => unknown
>();

const ipcMainHandle = vi.fn(
	(
		channel: string,
		handler: (event: { sender: { id: number } }, ...args: unknown[]) => unknown,
	) => {
		handlers.set(channel, handler);
	},
);

vi.mock("electron", () => ({
	ipcMain: {
		handle: ipcMainHandle,
	},
}));

describe("secureHandle", () => {
	beforeEach(() => {
		handlers.clear();
		vi.clearAllMocks();
	});

	it("rejects untrusted senders", async () => {
		const { secureHandle, setTrustedWebContentsIds } = await import(
			"../secure"
		);

		setTrustedWebContentsIds([1]);

		const impl = vi.fn(() => true);
		secureHandle(IpcChannels.App.CopyImage, ipcCopyImageArgs, impl);

		const handler = handlers.get(IpcChannels.App.CopyImage);
		expect(handler).toBeTypeOf("function");

		await expect(
			Promise.resolve(handler?.({ sender: { id: 2 } }, "/tmp/a.png")),
		).rejects.toThrow("Unauthorized IPC sender");
		expect(impl).not.toHaveBeenCalled();
	});

	it("validates args via zod schema", async () => {
		const { secureHandle, setTrustedWebContentsIds } = await import(
			"../secure"
		);

		setTrustedWebContentsIds([1]);

		const impl = vi.fn(() => true);
		secureHandle(IpcChannels.App.CopyImage, ipcCopyImageArgs, impl);

		const handler = handlers.get(IpcChannels.App.CopyImage);
		expect(handler).toBeTypeOf("function");

		await expect(
			Promise.resolve(handler?.({ sender: { id: 1 } }, "")),
		).rejects.toBeTruthy();
		expect(impl).not.toHaveBeenCalled();

		await expect(
			Promise.resolve(handler?.({ sender: { id: 1 } }, "/tmp/a.png")),
		).resolves.toBe(true);
		expect(impl).toHaveBeenCalledWith("/tmp/a.png");
	});
});
