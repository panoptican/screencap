import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	DEFAULT_AVATAR_COLORS,
	DEFAULT_FOREGROUND_COLORS,
	generateAvatarDataUrl,
} from "@/lib/avatar";
import { cn } from "@/lib/utils";
import type { AvatarSettings } from "@/types";

interface AvatarPickerProps {
	username: string;
	settings: AvatarSettings;
	onChange: (settings: AvatarSettings) => void;
}

const ASCII_GLYPHS = [
	"@",
	"#",
	"%",
	"&",
	"*",
	"+",
	"=",
	"?",
	"!",
	"$",
] as const;

const PREVIEW_PX = 96; // matches h-24/w-24
const PREVIEW_RENDER_SCALE = 4; // keep consistent with UserAvatar render scale

export function AvatarPicker({
	username,
	settings,
	onChange,
}: AvatarPickerProps) {
	const letter = useMemo(
		() => username.charAt(0).toUpperCase() || "?",
		[username],
	);

	const [previewUrl, setPreviewUrl] = useState("");

	useEffect(() => {
		const url = generateAvatarDataUrl(
			letter,
			PREVIEW_PX * PREVIEW_RENDER_SCALE,
			settings,
		);
		setPreviewUrl(url);
	}, [letter, settings]);

	// Safety: in case any legacy settings slip through, normalize to ascii.
	useEffect(() => {
		if (settings.pattern !== "ascii") {
			onChange({ ...settings, pattern: "ascii" });
		}
	}, [settings, onChange]);

	const handleBackgroundChange = useCallback(
		(backgroundColor: string) => {
			onChange({ ...settings, backgroundColor });
		},
		[settings, onChange],
	);

	const handleForegroundChange = useCallback(
		(foregroundColor: string) => {
			onChange({ ...settings, foregroundColor });
		},
		[settings, onChange],
	);

	const handleAsciiCharChange = useCallback(
		(asciiChar: string) => {
			onChange({ ...settings, asciiChar });
		},
		[settings, onChange],
	);

	return (
		<div className="space-y-6">
			<div className="flex items-start gap-6">
				<div className="shrink-0">
					<div className="relative">
						<div className="h-24 w-24 rounded-2xl overflow-hidden border border-border shadow-lg bg-muted/10">
							{previewUrl && (
								<img
									src={previewUrl}
									alt="Avatar preview"
									className="h-full w-full object-cover"
									decoding="async"
								/>
							)}
						</div>
						<div className="absolute -bottom-1 -right-1 px-2 py-0.5 rounded-md bg-background border border-border text-[10px] font-mono text-muted-foreground">
							{letter}
						</div>
					</div>
				</div>

				<div className="flex-1 space-y-4">
					<div>
						<div className="text-xs font-medium text-muted-foreground mb-2">
							Style
						</div>
						<div className="flex flex-wrap gap-2">
							<Button
								type="button"
								variant="ghost"
								className="h-10 px-3 rounded-xl overflow-hidden border-2 border-primary ring-2 ring-primary/20 font-mono text-xs"
								disabled
							>
								ASCII
							</Button>
						</div>
					</div>

					<div>
						<div className="text-xs font-medium text-muted-foreground mb-2">
							ASCII glyph
						</div>
						<div className="flex flex-wrap gap-2">
							{ASCII_GLYPHS.map((g) => (
								<Button
									key={g}
									type="button"
									variant="ghost"
									className={cn(
										"h-10 w-10 p-0 rounded-xl overflow-hidden border-2 transition-all font-mono text-base",
										(settings.asciiChar ?? "@") === g
											? "border-primary ring-2 ring-primary/20"
											: "border-border/50 hover:border-border",
									)}
									onClick={() => handleAsciiCharChange(g)}
									title={`Use "${g}"`}
								>
									{g}
								</Button>
							))}
						</div>
					</div>
				</div>
			</div>

			<div>
				<div className="text-xs font-medium text-muted-foreground mb-2">
					Background
				</div>
				<div className="flex flex-wrap gap-1.5">
					{DEFAULT_AVATAR_COLORS.map((color) => (
						<button
							key={color}
							type="button"
							className={cn(
								"h-7 w-7 rounded-lg transition-all border-2",
								settings.backgroundColor === color
									? "border-primary ring-2 ring-primary/20 scale-110"
									: "border-transparent hover:scale-105",
							)}
							style={{ backgroundColor: color }}
							onClick={() => handleBackgroundChange(color)}
							title={color}
						/>
					))}
				</div>
			</div>

			<div>
				<div className="text-xs font-medium text-muted-foreground mb-2">
					Foreground
				</div>
				<div className="flex flex-wrap gap-1.5">
					{DEFAULT_FOREGROUND_COLORS.map((color) => (
						<button
							key={color}
							type="button"
							className={cn(
								"h-7 w-7 rounded-lg transition-all border-2",
								settings.foregroundColor === color
									? "border-primary ring-2 ring-primary/20 scale-110"
									: "border-border/30 hover:scale-105",
							)}
							style={{ backgroundColor: color }}
							onClick={() => handleForegroundChange(color)}
							title={color}
						/>
					))}
				</div>
			</div>
		</div>
	);
}
