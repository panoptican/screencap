import { useCallback, useEffect } from "react";
import { v4 as uuid } from "uuid";
import { useAppStore } from "@/stores/app";
import type { Memory } from "@/types";

export function useMemories() {
	const memories = useAppStore((s) => s.memories);
	const setMemories = useAppStore((s) => s.setMemories);
	const addMemory = useAppStore((s) => s.addMemory);
	const updateMemory = useAppStore((s) => s.updateMemory);
	const removeMemory = useAppStore((s) => s.removeMemory);

	const fetchMemories = useCallback(
		async (type?: string) => {
			if (!window.api) return;
			const result = await window.api.storage.getMemories(type);
			setMemories(result);
		},
		[setMemories],
	);

	const createMemory = useCallback(
		async (
			type: Memory["type"],
			content: string,
			description?: string | null,
		) => {
			if (!window.api) return null;
			const normalizedDescription = description?.trim();
			const memory: Memory = {
				id: uuid(),
				type,
				content,
				...(normalizedDescription
					? { description: normalizedDescription }
					: {}),
				createdAt: Date.now(),
				updatedAt: Date.now(),
			};
			await window.api.storage.insertMemory(memory);
			addMemory(memory);
			return memory;
		},
		[addMemory],
	);

	const editMemory = useCallback(
		async (
			id: string,
			updates: { content: string; description?: string | null },
		) => {
			if (!window.api) return;
			const normalized = {
				content: updates.content.trim(),
				...(updates.description === undefined
					? {}
					: { description: updates.description?.trim() || null }),
			};
			await window.api.storage.updateMemory(id, normalized);
			updateMemory(id, normalized);
		},
		[updateMemory],
	);

	const deleteMemory = useCallback(
		async (id: string) => {
			if (!window.api) return;
			await window.api.storage.deleteMemory(id);
			removeMemory(id);
		},
		[removeMemory],
	);

	useEffect(() => {
		fetchMemories();
	}, [fetchMemories]);

	return {
		memories,
		fetchMemories,
		createMemory,
		editMemory,
		deleteMemory,
		addictions: memories.filter((m) => m.type === "addiction"),
		projects: memories.filter((m) => m.type === "project"),
		preferences: memories.filter((m) => m.type === "preference"),
	};
}
