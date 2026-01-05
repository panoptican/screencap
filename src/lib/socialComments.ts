export type ParsedEventComment = {
	eventId: string;
	text: string;
};

const PREFIX = "@event:" as const;

export function encodeEventComment(eventId: string, text: string): string {
	const cleanEventId = eventId.trim();
	const cleanText = text.trim();
	if (!cleanEventId) throw new Error("Invalid eventId");
	if (!cleanText) throw new Error("Empty comment");
	return `${PREFIX}${cleanEventId} ${cleanText}`;
}

export function parseEventComment(
	messageText: string,
): ParsedEventComment | null {
	if (!messageText.startsWith(PREFIX)) return null;
	const rest = messageText.slice(PREFIX.length);
	const spaceIdx = rest.indexOf(" ");
	if (spaceIdx <= 0) return null;
	const eventId = rest.slice(0, spaceIdx).trim();
	const text = rest.slice(spaceIdx + 1).trim();
	if (!eventId || !text) return null;
	return { eventId, text };
}
