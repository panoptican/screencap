import { endOfDay, format, startOfDay, subDays } from "date-fns";
import { Calendar as CalendarIcon, Check } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type Preset = "today" | "yesterday" | "7d" | "30d" | "all" | "custom";

interface DateRangeSelectProps {
	startDate?: number;
	endDate?: number;
	onChange: (start?: number, end?: number) => void;
	className?: string;
}

const PRESETS: { key: Preset; label: string }[] = [
	{ key: "today", label: "Today" },
	{ key: "yesterday", label: "Yesterday" },
	{ key: "7d", label: "Last 7 days" },
	{ key: "30d", label: "Last 30 days" },
	{ key: "all", label: "All time" },
];

function getActivePreset(startDate?: number, endDate?: number): Preset {
	if (!startDate && !endDate) return "all";
	if (!startDate || !endDate) return "custom";

	const now = new Date();
	const todayStart = startOfDay(now).getTime();
	const todayEnd = endOfDay(now).getTime();
	const yesterdayStart = startOfDay(subDays(now, 1)).getTime();
	const yesterdayEnd = endOfDay(subDays(now, 1)).getTime();

	if (startDate === todayStart && endDate === todayEnd) return "today";
	if (startDate === yesterdayStart && endDate === yesterdayEnd)
		return "yesterday";

	const diff = endDate - startDate;
	const oneDay = 86_400_000;

	if (diff <= 7 * oneDay && endDate === todayEnd) return "7d";
	if (diff <= 30 * oneDay && endDate === todayEnd) return "30d";
	return "custom";
}

function getPresetLabel(
	preset: Preset,
	startDate?: number,
	endDate?: number,
): string {
	if (preset === "custom" && startDate && endDate) {
		const start = format(new Date(startDate), "MMM d");
		const end = format(new Date(endDate), "MMM d");
		return start === end ? start : `${start} – ${end}`;
	}
	return PRESETS.find((p) => p.key === preset)?.label ?? "Select dates";
}

export function DateRangeSelect({
	startDate,
	endDate,
	onChange,
	className,
}: DateRangeSelectProps) {
	const [open, setOpen] = React.useState(false);
	const [showCustom, setShowCustom] = React.useState(false);
	const [customStart, setCustomStart] = React.useState<Date | undefined>(
		startDate ? new Date(startDate) : undefined,
	);
	const [customEnd, setCustomEnd] = React.useState<Date | undefined>(
		endDate ? new Date(endDate) : undefined,
	);

	const activePreset = getActivePreset(startDate, endDate);
	const label = getPresetLabel(activePreset, startDate, endDate);

	React.useEffect(() => {
		if (open) {
			setShowCustom(activePreset === "custom");
			setCustomStart(startDate ? new Date(startDate) : undefined);
			setCustomEnd(endDate ? new Date(endDate) : undefined);
		}
	}, [open, activePreset, startDate, endDate]);

	const applyPreset = React.useCallback(
		(preset: Preset) => {
			if (preset === "all") {
				onChange(undefined, undefined);
				setOpen(false);
				return;
			}

			const now = new Date();

			if (preset === "yesterday") {
				const yesterday = subDays(now, 1);
				onChange(
					startOfDay(yesterday).getTime(),
					endOfDay(yesterday).getTime(),
				);
				setOpen(false);
				return;
			}

			const end = endOfDay(now).getTime();
			const days = preset === "today" ? 0 : preset === "7d" ? 6 : 29;
			const start = startOfDay(subDays(now, days)).getTime();

			onChange(start, end);
			setOpen(false);
		},
		[onChange],
	);

	const applyCustomRange = React.useCallback(() => {
		if (!customStart || !customEnd) return;
		onChange(startOfDay(customStart).getTime(), endOfDay(customEnd).getTime());
		setOpen(false);
	}, [customStart, customEnd, onChange]);

	const handleStartSelect = React.useCallback(
		(date?: Date) => {
			if (!date) return;
			setCustomStart(date);
			if (customEnd && date > customEnd) {
				setCustomEnd(date);
			}
		},
		[customEnd],
	);

	const handleEndSelect = React.useCallback(
		(date?: Date) => {
			if (!date) return;
			setCustomEnd(date);
			if (customStart && date < customStart) {
				setCustomStart(date);
			}
		},
		[customStart],
	);

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button
					variant="outline"
					size="sm"
					className={cn(
						"h-8 gap-2 px-3 text-xs font-normal no-drag",
						className,
					)}
				>
					<CalendarIcon className="h-4 w-4 text-muted-foreground" />
					<span>{label}</span>
				</Button>
			</PopoverTrigger>
			<PopoverContent
				align="start"
				className="w-auto p-0 no-drag"
				sideOffset={8}
			>
				<div className="flex">
					<div className="flex flex-col border-r border-border p-2 min-w-[140px]">
						{PRESETS.map((preset) => (
							<button
								key={preset.key}
								type="button"
								onClick={() => applyPreset(preset.key)}
								className={cn(
									"flex items-center gap-2 rounded-md px-3 py-2 text-xs text-left transition-colors hover:bg-accent/10",
									activePreset === preset.key &&
										!showCustom &&
										"bg-accent/10 font-medium",
								)}
							>
								<span className="w-4 h-4 flex items-center justify-center">
									{activePreset === preset.key && !showCustom && (
										<Check className="h-3 w-3" />
									)}
								</span>
								{preset.label}
							</button>
						))}
						<div className="h-px bg-border my-2" />
						<button
							type="button"
							onClick={() => setShowCustom(true)}
							className={cn(
								"flex items-center gap-2 rounded-md px-3 py-2 text-xs text-left transition-colors hover:bg-accent/10",
								showCustom && "bg-accent/10 font-medium",
							)}
						>
							<span className="w-4 h-4 flex items-center justify-center">
								{showCustom && <Check className="h-3 w-3" />}
							</span>
							Custom range
						</button>
					</div>

					{showCustom && (
						<div className="p-3 space-y-3">
							<div className="flex gap-4">
								<div className="space-y-1">
									<div className="text-xs text-muted-foreground px-1">From</div>
									<Calendar
										mode="single"
										selected={customStart}
										onSelect={handleStartSelect}
										className="rounded-md border"
									/>
								</div>
								<div className="space-y-1">
									<div className="text-xs text-muted-foreground px-1">To</div>
									<Calendar
										mode="single"
										selected={customEnd}
										onSelect={handleEndSelect}
										className="rounded-md border"
									/>
								</div>
							</div>
							<div className="flex justify-end gap-2">
								<Button
									variant="ghost"
									size="sm"
									className="h-7 text-xs"
									onClick={() => setShowCustom(false)}
								>
									Cancel
								</Button>
								<Button
									size="sm"
									className="h-7 text-xs"
									disabled={!customStart || !customEnd}
									onClick={applyCustomRange}
								>
									Apply
								</Button>
							</div>
						</div>
					)}
				</div>
			</PopoverContent>
		</Popover>
	);
}
