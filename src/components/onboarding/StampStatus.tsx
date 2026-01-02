import { motion } from "framer-motion";

interface StampStatusProps {
	className?: string;
}

export function StampStatus({ className = "" }: StampStatusProps) {
	return (
		<div className={`flex items-center justify-center py-2 ${className}`}>
			<motion.div
				initial={{ scale: 0.9, opacity: 0 }}
				animate={{ scale: 1, opacity: 1 }}
				transition={{
					type: "spring",
					stiffness: 300,
					damping: 20,
				}}
				className="relative"
			>
				<div className="relative z-10 flex items-center justify-center px-6 py-1.5 rounded-lg bg-green-500/10 border border-green-500/20 text-green-500  text-sm shadow-[0_0_20px_rgba(34,197,94,0.15)] backdrop-blur-sm select-none">
					Permission Granted
				</div>

				<motion.div
					initial={{ opacity: 0.5, scale: 1 }}
					animate={{ opacity: 0, scale: 1.15 }}
					transition={{
						duration: 2,
						ease: "easeOut",
						repeat: Infinity,
						repeatDelay: 1,
					}}
					className="absolute inset-0 rounded-lg border border-green-500/30"
				/>

				<motion.div
					animate={{ opacity: [0.3, 0.6, 0.3] }}
					transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
					className="absolute inset-0 bg-green-500/5 rounded-lg"
				/>
			</motion.div>
		</div>
	);
}
