import { cn } from "@/lib/utils";
import type { AvatarSettings } from "@/types";
import { UserAvatar, type UserAvatarSize } from "../avatar/UserAvatar";

export interface AuthorAvatarProps {
	userId?: string | null;
	username: string;
	isMe?: boolean;
	size?: "sm" | "md" | "lg" | "xl";
	avatarSettings?: AvatarSettings;
}

const SIZE_TO_USER_AVATAR_SIZE: Record<
	NonNullable<AuthorAvatarProps["size"]>,
	UserAvatarSize
> = {
	sm: "xs",
	md: "sm",
	lg: "md",
	xl: "lg",
};

export function AuthorAvatar({
	userId,
	username,
	isMe = false,
	size = "sm",
	avatarSettings,
}: AuthorAvatarProps) {
	const userAvatarSize = SIZE_TO_USER_AVATAR_SIZE[size];
	return (
		<UserAvatar
			userId={userId}
			username={username}
			size={userAvatarSize}
			avatarSettings={isMe ? avatarSettings : undefined}
			fallback="initial"
			roundedClassName={isMe ? "rounded-lg" : "rounded-full"}
			className={cn(isMe && "border border-primary/40")}
			fallbackClassName={cn(
				"flex items-center justify-center font-medium",
				isMe
					? "border border-primary/40 text-primary/70 bg-transparent"
					: "bg-primary text-primary-foreground",
			)}
			title={isMe ? `${username} (you)` : username}
		/>
	);
}
