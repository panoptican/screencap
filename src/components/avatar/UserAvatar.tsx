import { useMemo } from "react";
import { generateAvatarDataUrl } from "@/lib/avatar";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/stores/app";
import { useSocialDirectoryStore } from "@/stores/socialDirectory";
import type { AvatarSettings } from "@/types";

export type UserAvatarSize = "xs" | "sm" | "md" | "lg" | "xl";
export type UserAvatarFallback = "initial" | "initials";

export interface UserAvatarProps {
	userId?: string | null;
	username: string;
	size: UserAvatarSize;
	className?: string;
	title?: string;
	avatarUrl?: string | null;
	avatarSettings?: AvatarSettings | null;
	roundedClassName?: string;
	imageClassName?: string;
	fallbackClassName?: string;
	fallback?: UserAvatarFallback;
}

const SIZE_MAP: Record<
	UserAvatarSize,
	{ container: string; px: number; text: string }
> = {
	xs: { container: "h-5 w-5", px: 20, text: "text-[9px]" },
	sm: { container: "h-7 w-7", px: 24, text: "text-[10px]" },
	md: { container: "h-9 w-9", px: 36, text: "text-xs" },
	lg: { container: "h-12 w-12", px: 48, text: "text-lg" },
	xl: { container: "h-16 w-16", px: 64, text: "text-xl" },
};

const DEFAULT_ROUNDED: Record<UserAvatarSize, string> = {
	xs: "rounded-sm",
	sm: "rounded-sm",
	md: "rounded-md",
	lg: "rounded-lg",
	xl: "rounded-xl",
};

// Generate avatars at higher pixel density so they stay crisp when scaled down.
const RENDER_SCALE = 4;

const MAX_CACHED_AVATARS = 256;
const dataUrlCache = new Map<string, string>();
const cacheOrder: string[] = [];

function cacheKey(
	letter: string,
	px: number,
	settings: AvatarSettings,
): string {
	return [
		letter,
		px,
		settings.pattern,
		settings.backgroundColor,
		settings.foregroundColor,
		settings.asciiChar ?? "",
	].join("|");
}

function getCachedGeneratedAvatarUrl(
	letter: string,
	px: number,
	settings: AvatarSettings,
): string {
	const key = cacheKey(letter, px, settings);
	const cached = dataUrlCache.get(key);
	if (cached) return cached;

	const url = generateAvatarDataUrl(letter, px, settings);
	dataUrlCache.set(key, url);
	cacheOrder.push(key);

	if (cacheOrder.length > MAX_CACHED_AVATARS) {
		const oldest = cacheOrder.shift();
		if (oldest) dataUrlCache.delete(oldest);
	}

	return url;
}

function initials(username: string, mode: UserAvatarFallback): string {
	const trimmed = username.trim();
	if (!trimmed) return mode === "initials" ? "??" : "?";
	if (mode === "initial") return trimmed.slice(0, 1).toUpperCase();
	return trimmed.slice(0, 2).toUpperCase();
}

export function UserAvatar({
	userId,
	username,
	size,
	className,
	title,
	avatarUrl,
	avatarSettings,
	roundedClassName,
	imageClassName,
	fallbackClassName,
	fallback = "initials",
}: UserAvatarProps) {
	const myAvatarSettings = useAppStore((s) => s.settings.avatar);
	const identityUserId = useSocialDirectoryStore(
		(s) => s.identity?.userId ?? null,
	);
	const friendAvatarSettings = useSocialDirectoryStore((s) => {
		if (!userId) return null;
		return s.friendsByUserId[userId]?.avatarSettings ?? null;
	});

	const resolvedSettings = useMemo(() => {
		if (avatarSettings) return avatarSettings;
		if (userId && identityUserId && userId === identityUserId)
			return myAvatarSettings;
		return friendAvatarSettings;
	}, [
		avatarSettings,
		friendAvatarSettings,
		identityUserId,
		myAvatarSettings,
		userId,
	]);

	const sizeConfig = SIZE_MAP[size];
	const rounded = roundedClassName ?? DEFAULT_ROUNDED[size];

	const resolvedUrl = useMemo(() => {
		if (avatarUrl) return avatarUrl;
		if (!resolvedSettings) return null;
		const letter = username.charAt(0).toUpperCase() || "?";
		return getCachedGeneratedAvatarUrl(
			letter,
			sizeConfig.px * RENDER_SCALE,
			resolvedSettings,
		);
	}, [avatarUrl, resolvedSettings, sizeConfig.px, username]);

	const containerClassName = cn(
		"shrink-0 overflow-hidden",
		sizeConfig.container,
		rounded,
		className,
	);

	if (resolvedUrl) {
		return (
			<div className={containerClassName} title={title ?? username}>
				<img
					src={resolvedUrl}
					alt={username}
					className={cn("h-full w-full object-cover", imageClassName)}
				/>
			</div>
		);
	}

	return (
		<div
			className={cn(
				containerClassName,
				fallbackClassName ??
					"bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center font-medium text-foreground/80",
				sizeConfig.text,
			)}
			title={title ?? username}
		>
			{initials(username, fallback)}
		</div>
	);
}
