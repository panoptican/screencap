import { useEffect, useRef } from "react";
import * as THREE from "three";
import helvetikerRegular from "three/examples/fonts/helvetiker_regular.typeface.json";
import { AsciiEffect } from "three/examples/jsm/effects/AsciiEffect.js";
import { TextGeometry } from "three/examples/jsm/geometries/TextGeometry.js";
import { FontLoader } from "three/examples/jsm/loaders/FontLoader.js";

interface AsciiLogoProps {
	text?: string;
	className?: string;
}

export function AsciiLogo({
	text = "Screencap",
	className = "",
}: AsciiLogoProps) {
	const containerRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!containerRef.current) return;

		const container = containerRef.current;
		let width = container.clientWidth;
		let height = container.clientHeight;

		const scene = new THREE.Scene();
		scene.background = new THREE.Color(0x0a0a0a);

		const camera = new THREE.PerspectiveCamera(70, width / height, 1, 2000);
		camera.position.set(0, 0, 400);

		const ambientLight = new THREE.AmbientLight(0xffffff, 0.15);
		scene.add(ambientLight);

		const pointLight1 = new THREE.PointLight(0xffffff, 0.8, 0, 0);
		pointLight1.position.set(500, 500, 500);
		scene.add(pointLight1);

		const pointLight2 = new THREE.PointLight(0xffffff, 0.3, 0, 0);
		pointLight2.position.set(-500, -500, -500);
		scene.add(pointLight2);

		const mouseLight = new THREE.PointLight(0xffd700, 0, 400, 2);
		mouseLight.position.set(0, 0, 100);
		scene.add(mouseLight);

		const loader = new FontLoader();
		const font = loader.parse(helvetikerRegular);

		const geometry = new TextGeometry(text, {
			font: font,
			size: 130,
			depth: 25,
			curveSegments: 12,
			bevelEnabled: true,
			bevelThickness: 2,
			bevelSize: 1,
			bevelOffset: 0,
			bevelSegments: 5,
		});

		geometry.computeBoundingBox();
		geometry.center();

		const material = new THREE.MeshPhongMaterial({
			color: 0xffffff,
			flatShading: true,
		});

		const textMesh = new THREE.Mesh(geometry, material);
		textMesh.position.x = -90;
		scene.add(textMesh);

		const renderer = new THREE.WebGLRenderer({ antialias: true });
		renderer.setSize(width, height);

		const effect = new AsciiEffect(renderer, " .:-=+*#%@", {
			invert: true,
			resolution: 0.4,
		});
		effect.setSize(width, height);
		effect.domElement.style.color = "white";
		effect.domElement.style.backgroundColor = "transparent";

		const styleId = "ascii-effect-style";
		if (!document.getElementById(styleId)) {
			const style = document.createElement("style");
			style.id = styleId;
			style.textContent = `
				.ascii-effect-container {
					background: transparent !important;
					display: flex !important;
					justify-content: center !important;
					align-items: center !important;
				}
				.ascii-effect-container table {
					font-family: "ui-monospace", "SFMono-Regular", "Menlo", "Monaco", "Consolas", monospace !important;
					font-weight: 500 !important;
					line-height: 1.0 !important;
					letter-spacing: 0px !important;
					margin: 0 auto !important;
				}
			`;
			document.head.appendChild(style);
		}
		effect.domElement.classList.add("ascii-effect-container");
		container.appendChild(effect.domElement);

		let animationId: number;
		let time = 0;
		let targetMouseLightIntensity = 0;
		let currentMouseLightIntensity = 0;
		let mouseX = 0;
		let mouseY = 0;
		let targetMouseX = 0;
		let targetMouseY = 0;

		const handleMouseMove = (e: MouseEvent) => {
			const rect = container.getBoundingClientRect();
			const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
			const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
			targetMouseX = x * 400;
			targetMouseY = y * 200;
		};

		const handleMouseEnter = () => {
			targetMouseLightIntensity = 15;
		};

		const handleMouseLeave = () => {
			targetMouseLightIntensity = 0;
		};

		container.addEventListener("mousemove", handleMouseMove);
		container.addEventListener("mouseenter", handleMouseEnter);
		container.addEventListener("mouseleave", handleMouseLeave);

		const animate = () => {
			animationId = requestAnimationFrame(animate);
			time += 0.008;

			textMesh.rotation.x = Math.sin(time * 0.5) * 0.05;
			textMesh.rotation.y = Math.sin(time * 0.3) * 0.08;

			currentMouseLightIntensity +=
				(targetMouseLightIntensity - currentMouseLightIntensity) * 0.1;
			mouseLight.intensity = currentMouseLightIntensity;

			mouseX += (targetMouseX - mouseX) * 0.1;
			mouseY += (targetMouseY - mouseY) * 0.1;
			mouseLight.position.set(mouseX, mouseY, 200);

			effect.render(scene, camera);
		};

		animate();

		const handleResize = () => {
			width = container.clientWidth;
			height = container.clientHeight;
			camera.aspect = width / height;
			camera.updateProjectionMatrix();
			renderer.setSize(width, height);
			effect.setSize(width, height);
		};

		window.addEventListener("resize", handleResize);

		return () => {
			window.removeEventListener("resize", handleResize);
			container.removeEventListener("mousemove", handleMouseMove);
			container.removeEventListener("mouseenter", handleMouseEnter);
			container.removeEventListener("mouseleave", handleMouseLeave);
			cancelAnimationFrame(animationId);
			if (container.contains(effect.domElement)) {
				container.removeChild(effect.domElement);
			}
			renderer.dispose();
			geometry.dispose();
			material.dispose();
		};
	}, [text]);

	return (
		<div
			ref={containerRef}
			className={`w-full h-[280px] overflow-hidden ${className}`}
		/>
	);
}
