import { useMemo } from "react";
import { generateAvatarDataUrl } from "@/lib/avatar";

function initials(username: string): string {
	const trimmed = username.trim();
	if (!trimmed) return "??";
	return trimmed.slice(0, 2).toUpperCase();
}

export function AvatarDisplay({
	username,
	size,
	isOwn,
	ownAvatarUrl,
	avatarSettings,
	className,
}: {
	username: string;
	size: "xs" | "sm" | "md" | "lg";
	isOwn?: boolean;
	ownAvatarUrl?: string | null;
	avatarSettings?: {
		pattern: string;
		backgroundColor: string;
		foregroundColor: string;
	} | null;
	className?: string;
}) {
	const sizeClasses = {
		xs: "h-5 w-5 text-[9px]",
		sm: "h-7 w-7 text-[10px]",
		md: "h-9 w-9 text-xs",
		lg: "h-12 w-12 text-lg",
	};
	const sizePx = { xs: 20, sm: 24, md: 36, lg: 48 };

	const avatarUrl = useMemo(() => {
		if (isOwn && ownAvatarUrl) return ownAvatarUrl;
		if (avatarSettings) {
			const letter = username.charAt(0).toUpperCase();
			return generateAvatarDataUrl(
				letter,
				sizePx[size] * 2,
				avatarSettings as Parameters<typeof generateAvatarDataUrl>[2],
			);
		}
		return null;
	}, [isOwn, ownAvatarUrl, avatarSettings, username, size]);

	if (avatarUrl) {
		return (
			<div
				className={`${sizeClasses[size]} shrink-0 rounded-${size} overflow-hidden ${className ?? ""}`}
			>
				<img
					src={avatarUrl}
					alt={username}
					className="h-full w-full object-cover"
				/>
			</div>
		);
	}

	return (
		<div
			className={`${sizeClasses[size]} shrink-0 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center font-medium text-foreground/80 ${className ?? ""}`}
		>
			{initials(username)}
		</div>
	);
}
