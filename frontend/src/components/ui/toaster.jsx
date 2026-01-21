import {
	Toast,
	ToastClose,
	ToastDescription,
	ToastProvider,
	ToastTitle,
	ToastViewport,
} from '@/components/ui/toast';
import { useToast } from '@/components/ui/use-toast';
import React, { useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';

export function Toaster() {
	const { toasts } = useToast();
	const containerRef = useRef(null);

	useEffect(() => {
		// Crear o obtener el contenedor de toasts
		let container = document.getElementById('toast-container');
		if (!container) {
			container = document.createElement('div');
			container.id = 'toast-container';
			container.style.cssText = `
				position: fixed;
				z-index: 2147483647;
				pointer-events: none;
				isolation: isolate;
				transform: none;
				filter: none;
				backdrop-filter: none;
				opacity: 1;
				will-change: auto;
			`;
			document.body.appendChild(container);
		}
		containerRef.current = container;

		return () => {
			// Limpiar el contenedor si no hay toasts
			if (container && toasts.length === 0) {
				// No eliminar el contenedor, solo dejarlo vacío
			}
		};
	}, [toasts.length]);

	if (!containerRef.current) {
		return null;
	}

	return ReactDOM.createPortal(
		<ToastProvider>
			{toasts.map(({ id, title, description, action, dismiss, ...props }) => {
				return (
					<Toast key={id} {...props}>
						<div className="grid gap-1">
							{title && <ToastTitle>{title}</ToastTitle>}
							{description && (
								<ToastDescription>{description}</ToastDescription>
							)}
						</div>
						{action}
						<ToastClose />
					</Toast>
				);
			})}
			<ToastViewport />
		</ToastProvider>,
		containerRef.current
	);
}