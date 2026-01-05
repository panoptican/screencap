import { UserAvatar } from "@/components/avatar/UserAvatar";
import type { AvatarSettings } from "@/types";

export function AvatarDisplay({
	userId,
	username,
	size,
	isOwn,
	ownAvatarUrl,
	avatarSettings,
	className,
}: {
	userId?: string | null;
	username: string;
	size: "xs" | "sm" | "md" | "lg";
	isOwn?: boolean;
	ownAvatarUrl?: string | null;
	avatarSettings?: AvatarSettings | null;
	className?: string;
}) {
	return (
		<UserAvatar
			userId={userId}
			username={username}
			size={size}
			className={className}
			avatarUrl={isOwn ? ownAvatarUrl : null}
			avatarSettings={avatarSettings ?? null}
		/>
	);
}
