import * as PopoverPrimitive from "@radix-ui/react-popover";
import { Command } from "cmdk";
import { Check, ChevronsUpDown } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ComboboxOption = {
	value: string;
	label: string;
	icon?: React.ReactNode;
};

export interface ComboboxProps {
	value?: string;
	onValueChange: (value?: string) => void;
	options: ComboboxOption[];
	placeholder: string;
	allLabel: string;
	allIcon?: React.ReactNode;
	searchPlaceholder?: string;
	emptyText?: string;
	searchable?: boolean;
	dropdownMinWidth?: number;
	className?: string;
}

const ALL_VALUE = "__all__";

export function Combobox({
	value,
	onValueChange,
	options,
	placeholder,
	allLabel,
	allIcon,
	searchPlaceholder = "Search...",
	emptyText = "No results.",
	searchable = true,
	dropdownMinWidth,
	className,
}: ComboboxProps) {
	const [open, setOpen] = React.useState(false);

	const selected = React.useMemo(
		() => options.find((o) => o.value === value) ?? null,
		[options, value],
	);
	const triggerLabel = selected?.label ?? allLabel;
	const triggerIcon = selected?.icon ?? allIcon;

	const handleSelect = React.useCallback(
		(next: string) => {
			if (next === ALL_VALUE) {
				onValueChange(undefined);
				setOpen(false);
				return;
			}
			onValueChange(next);
			setOpen(false);
		},
		[onValueChange],
	);

	return (
		<PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
			<PopoverPrimitive.Trigger asChild>
				<Button
					type="button"
					variant="outline"
					size="sm"
					className={cn(
						"h-8 justify-between px-2 text-xs font-normal",
						!selected && !allIcon && "text-muted-foreground",
						className,
					)}
				>
					<span className="flex min-w-0 items-center gap-2">
						{triggerIcon && (
							<span className="flex h-4 w-4 shrink-0 items-center justify-center text-muted-foreground">
								{triggerIcon}
							</span>
						)}
						<span className="min-w-0 flex-1 truncate">
							{triggerLabel || placeholder}
						</span>
					</span>
					<ChevronsUpDown className="h-4 w-4 opacity-50" />
				</Button>
			</PopoverPrimitive.Trigger>
			<PopoverPrimitive.Portal>
				<PopoverPrimitive.Content
					align="start"
					sideOffset={6}
					style={
						dropdownMinWidth != null
							? {
									width: `max(var(--radix-popover-trigger-width), ${dropdownMinWidth}px)`,
								}
							: { width: "var(--radix-popover-trigger-width)" }
					}
					className="z-50 overflow-hidden rounded-md border border-border bg-popover text-popover-foreground shadow-md"
				>
					<Command className="w-full">
						{searchable && (
							<div className="border-b border-border">
								<Command.Input
									placeholder={searchPlaceholder}
									className="h-8 w-full rounded-md bg-transparent px-2 text-xs outline-none placeholder:text-muted-foreground"
								/>
							</div>
						)}
						<Command.List
							className={cn(
								"max-h-72 overflow-y-auto p-1",
								!searchable && "pt-1",
							)}
						>
							<Command.Empty className="px-2 py-6 text-center text-xs text-muted-foreground">
								{emptyText}
							</Command.Empty>
							<Command.Group>
								<Command.Item
									value={ALL_VALUE}
									onSelect={handleSelect}
									className="flex min-w-0 cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-xs outline-none data-[selected=true]:bg-accent/15"
								>
									<span className="flex h-4 w-4 shrink-0 items-center justify-center">
										{value == null && <Check className="h-4 w-4" />}
									</span>
									{allIcon && (
										<span className="flex h-4 w-4 shrink-0 items-center justify-center text-muted-foreground">
											{allIcon}
										</span>
									)}
									<span className="min-w-0 flex-1 truncate">{allLabel}</span>
								</Command.Item>
								{options.map((opt) => (
									<Command.Item
										key={opt.value}
										value={`${opt.label} ${opt.value}`}
										onSelect={() => handleSelect(opt.value)}
										className="flex min-w-0 cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-xs outline-none data-[selected=true]:bg-accent/15"
									>
										<span className="flex h-4 w-4 shrink-0 items-center justify-center">
											{value === opt.value && <Check className="h-4 w-4" />}
										</span>
										{opt.icon && (
											<span className="flex h-4 w-4 shrink-0 items-center justify-center text-muted-foreground">
												{opt.icon}
											</span>
										)}
										<span className="min-w-0 flex-1 truncate">{opt.label}</span>
									</Command.Item>
								))}
							</Command.Group>
						</Command.List>
					</Command>
				</PopoverPrimitive.Content>
			</PopoverPrimitive.Portal>
		</PopoverPrimitive.Root>
	);
}
