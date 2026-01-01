import {
	ChevronDown,
	ChevronLeft,
	ChevronRight,
	ChevronUp,
} from "lucide-react";
import type * as React from "react";
import { DayPicker } from "react-day-picker";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

export function Calendar({
	className,
	classNames,
	showOutsideDays = true,
	...props
}: CalendarProps) {
	const mergedClassNames: NonNullable<CalendarProps["classNames"]> = {
		months: "relative flex flex-col sm:flex-row gap-4",
		month: "space-y-4",
		month_caption: "flex items-center justify-center pt-1",
		caption_label: "text-sm font-medium",
		nav: "absolute left-0 right-0 top-0 z-10 flex items-center justify-between px-1",
		button_previous: cn(
			buttonVariants({ variant: "ghost" }),
			"h-7 w-7 bg-transparent p-0 opacity-60 hover:opacity-100 no-drag cursor-pointer",
		),
		button_next: cn(
			buttonVariants({ variant: "ghost" }),
			"h-7 w-7 bg-transparent p-0 opacity-60 hover:opacity-100 no-drag cursor-pointer",
		),
		month_grid: "w-full border-collapse space-y-1",
		weekdays: "flex",
		weekday: "w-9 text-[0.8rem] font-normal text-muted-foreground",
		weeks: "flex flex-col gap-1",
		week: "flex w-full mt-2",
		day: "relative h-9 w-9 p-0 text-center text-sm focus-within:relative focus-within:z-20",
		day_button: cn(
			buttonVariants({ variant: "ghost" }),
			"h-9 w-9 p-0 font-normal aria-selected:bg-accent/20 aria-selected:text-accent-foreground aria-selected:opacity-100",
		),
		range_start:
			"aria-selected:bg-accent/20 aria-selected:text-accent-foreground rounded-l-md",
		range_end:
			"aria-selected:bg-accent/20 aria-selected:text-accent-foreground rounded-r-md",
		selected: "bg-accent/20 text-accent-foreground",
		range_middle:
			"aria-selected:bg-accent/10 aria-selected:text-accent-foreground",
		today: "text-foreground font-semibold",
		outside:
			"text-muted-foreground opacity-50 aria-selected:text-muted-foreground aria-selected:opacity-30",
		disabled: "text-muted-foreground opacity-40",
		hidden: "invisible",
		chevron: "h-4 w-4 pointer-events-none",
		...(classNames ?? {}),
	};

	return (
		<DayPicker
			showOutsideDays={showOutsideDays}
			className={cn("p-3", className)}
			classNames={mergedClassNames}
			components={{
				Chevron: ({ orientation, className: iconClassName, ...iconProps }) => {
					const Icon =
						orientation === "left"
							? ChevronLeft
							: orientation === "right"
								? ChevronRight
								: orientation === "up"
									? ChevronUp
									: ChevronDown;
					return (
						<Icon className={cn("h-4 w-4", iconClassName)} {...iconProps} />
					);
				},
			}}
			{...props}
		/>
	);
}
