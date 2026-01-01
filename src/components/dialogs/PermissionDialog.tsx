import { ExternalLink, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { usePermission } from "@/hooks/usePermission";

interface PermissionDialogProps {
	onDismiss: () => void;
}

export function PermissionDialog({ onDismiss }: PermissionDialogProps) {
	const { openSettings, checkPermission } = usePermission();

	const handleOpenSettings = async () => {
		await openSettings();
	};

	const handleCheckAgain = async () => {
		const hasPerm = await checkPermission();
		if (hasPerm) {
			onDismiss();
		}
	};

	return (
		<Dialog open onOpenChange={(open) => !open && onDismiss()}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<div className="mx-auto w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center mb-4">
						<Shield className="h-6 w-6 text-primary" />
					</div>
					<DialogTitle className="text-center">
						Screen Recording Permission Required
					</DialogTitle>
					<DialogDescription className="text-center">
						Screencap needs permission to capture your screen for activity
						tracking. Your screenshots are stored locally and only sent to
						OpenRouter for classification.
					</DialogDescription>
				</DialogHeader>

				<div className="bg-muted rounded-lg p-4 text-sm space-y-2">
					<p className="font-medium">To enable:</p>
					<ol className="list-decimal list-inside space-y-1 text-muted-foreground">
						<li>Open System Settings</li>
						<li>Go to Privacy & Security → Screen Recording</li>
						<li>
							Enable <strong>Electron</strong> (dev) or{" "}
							<strong>Screencap</strong> (production)
						</li>
						<li>Toggle OFF then ON if already added</li>
						<li>Click "Check Again" below</li>
					</ol>
				</div>

				<div className="flex gap-3">
					<Button
						variant="outline"
						className="flex-1"
						onClick={handleCheckAgain}
					>
						Check Again
					</Button>
					<Button className="flex-1 gap-2" onClick={handleOpenSettings}>
						Open Settings
						<ExternalLink className="h-4 w-4" />
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	);
}
