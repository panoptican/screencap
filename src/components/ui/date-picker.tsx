import { format } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Calendar, type CalendarProps } from "@/components/ui/calendar";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface DatePickerProps {
	value?: Date;
	onChange: (value?: Date) => void;
	placeholder?: string;
	className?: string;
	formatString?: string;
	closeOnSelect?: boolean;
	calendarProps?: Omit<CalendarProps, "mode" | "selected" | "onSelect">;
}

export function DatePicker({
	value,
	onChange,
	placeholder = "mm/dd/yyyy",
	className,
	formatString = "MM/dd/yyyy",
	closeOnSelect = true,
	calendarProps,
}: DatePickerProps) {
	const [open, setOpen] = React.useState(false);
	const label = value ? format(value, formatString) : undefined;

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button
					type="button"
					variant="outline"
					size="sm"
					data-empty={!value}
					className={cn(
						"h-8 w-[135px] justify-start gap-2 px-3 text-left text-xs font-normal data-[empty=true]:text-muted-foreground",
						className,
					)}
				>
					<CalendarIcon className="h-4 w-4 text-muted-foreground" />
					{label ? (
						<span className="truncate">{label}</span>
					) : (
						<span className="truncate">{placeholder}</span>
					)}
				</Button>
			</PopoverTrigger>
			<PopoverContent align="start" className="w-auto p-0 no-drag">
				<Calendar
					mode="single"
					selected={value}
					onSelect={(d) => {
						onChange(d);
						if (closeOnSelect) setOpen(false);
					}}
					{...calendarProps}
				/>
			</PopoverContent>
		</Popover>
	);
}
