import { z } from "zod";
import { IpcChannels } from "../../../shared/ipc";
import type { ChatMessage, ChatThread } from "../../../shared/types";
import {
	fetchMessages,
	listThreads,
	openDmThread,
	openProjectThread,
	sendMessage,
} from "../../features/chat/ChatService";
import { secureHandle } from "../secure";

const noArgs = z.tuple([]);
const openDmArgs = z.tuple([z.string().trim().min(1).max(256)]);
const openProjectArgs = z.tuple([z.string().trim().min(1).max(256)]);
const fetchMessagesArgs = z.union([
	z.tuple([z.string().trim().min(1).max(256)]),
	z.tuple([z.string().trim().min(1).max(256), z.number().int().optional()]),
]);
const sendMessageArgs = z.tuple([
	z.string().trim().min(1).max(256),
	z.string().max(10_000),
]);

export function registerChatHandlers(): void {
	secureHandle(
		IpcChannels.Chat.ListThreads,
		noArgs,
		async (): Promise<ChatThread[]> => {
			return await listThreads();
		},
	);

	secureHandle(
		IpcChannels.Chat.OpenDmThread,
		openDmArgs,
		async (friendUserId: string): Promise<string> => {
			return await openDmThread(friendUserId);
		},
	);

	secureHandle(
		IpcChannels.Chat.OpenProjectThread,
		openProjectArgs,
		async (roomId: string): Promise<string> => {
			return await openProjectThread(roomId);
		},
	);

	secureHandle(
		IpcChannels.Chat.FetchMessages,
		fetchMessagesArgs,
		async (threadId: string, since?: number): Promise<ChatMessage[]> => {
			return await fetchMessages({ threadId, since });
		},
	);

	secureHandle(
		IpcChannels.Chat.SendMessage,
		sendMessageArgs,
		async (threadId: string, text: string): Promise<void> => {
			await sendMessage({ threadId, text });
		},
	);
}
