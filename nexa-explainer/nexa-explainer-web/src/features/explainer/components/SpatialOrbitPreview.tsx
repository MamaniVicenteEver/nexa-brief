"use client";

import { Orbit } from "lucide-react";
import { useEffect, useRef } from "react";

type SpatialOrbitScene = {
  label: string;
  title: string;
  description: string;
  metric: string;
};

type OrbitRuntime = {
  renderer: import("three").WebGLRenderer;
  camera: import("three").PerspectiveCamera;
  scene: import("three").Scene;
  orbitGroup: import("three").Group;
  nodes: import("three").Mesh[];
  links: import("three").Line[];
};

function renderOrbit(runtime: OrbitRuntime, currentTime: number, activeIndex: number) {
  const progress = Math.max(0, Math.min(30, currentTime)) / 30;
  runtime.orbitGroup.rotation.y = progress * Math.PI * 1.65;
  runtime.orbitGroup.rotation.x = Math.sin(progress * Math.PI * 2) * 0.12;
  runtime.camera.position.x = Math.sin(progress * Math.PI * 1.4) * 0.3;
  runtime.camera.position.z = 6.7 - Math.sin(progress * Math.PI) * 0.38;
  runtime.camera.lookAt(0, 0, 0);

  runtime.nodes.forEach((node, index) => {
    const active = index === activeIndex;
    node.scale.setScalar(active ? 1.22 : 0.78);
    const material = node.material as import("three").MeshBasicMaterial;
    material.opacity = active ? 1 : 0.42;
    material.color.set(active ? "#b5f36a" : index % 2 ? "#45d6d0" : "#86a7b0");
  });
  runtime.links.forEach((link, index) => {
    const material = link.material as import("three").LineBasicMaterial;
    material.opacity = index === activeIndex ? 0.95 : 0.18;
  });
  runtime.renderer.render(runtime.scene, runtime.camera);
}

export function SpatialOrbitPreview({
  scene,
  currentTime,
  isPlaying,
}: {
  scene: SpatialOrbitScene;
  currentTime: number;
  isPlaying: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const runtimeRef = useRef<OrbitRuntime | null>(null);
  const activeIndex = Math.min(2, Math.floor(Math.max(0, currentTime) / 10));

  useEffect(() => {
    let cancelled = false;
    let resizeObserver: ResizeObserver | undefined;

    async function setup() {
      const canvas = canvasRef.current;
      const host = hostRef.current;
      if (!canvas || !host) return;
      try {
        const THREE = await import("three");
        if (cancelled) return;

        const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
        renderer.setPixelRatio(1);
        renderer.setClearColor(0x000000, 0);
        const scene3d = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(35, 16 / 9, 0.1, 100);
        camera.position.set(0, 0, 6.7);

        const orbitGroup = new THREE.Group();
        scene3d.add(orbitGroup);
        const ringMaterial = new THREE.MeshBasicMaterial({ color: 0x45d6d0, transparent: true, opacity: 0.25 });
        const ring = new THREE.Mesh(new THREE.TorusGeometry(2.05, 0.012, 8, 96), ringMaterial);
        ring.rotation.x = Math.PI * 0.16;
        orbitGroup.add(ring);
        const secondRing = new THREE.Mesh(new THREE.TorusGeometry(1.48, 0.008, 8, 96), ringMaterial.clone());
        secondRing.rotation.x = Math.PI * 0.64;
        secondRing.rotation.z = Math.PI * 0.18;
        orbitGroup.add(secondRing);

        const core = new THREE.Mesh(
          new THREE.IcosahedronGeometry(0.38, 1),
          new THREE.MeshBasicMaterial({ color: 0xeaf4f5, transparent: true, opacity: 0.94, wireframe: true }),
        );
        orbitGroup.add(core);

        const nodes: import("three").Mesh[] = [];
        const links: import("three").Line[] = [];
        const lineMaterial = new THREE.LineBasicMaterial({ color: 0x45d6d0, transparent: true, opacity: 0.2 });
        for (let index = 0; index < 4; index += 1) {
          const node = new THREE.Mesh(
            new THREE.SphereGeometry(index === 0 ? 0.16 : 0.12, 16, 12),
            new THREE.MeshBasicMaterial({ color: 0x45d6d0, transparent: true, opacity: 0.6 }),
          );
          const angle = (index / 4) * Math.PI * 2;
          node.position.set(Math.cos(angle) * 1.92, Math.sin(angle) * 0.72, Math.sin(angle) * 0.86);
          orbitGroup.add(node);
          nodes.push(node);
          const link = new THREE.Line(
            new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), node.position.clone()]),
            lineMaterial.clone(),
          );
          orbitGroup.add(link);
          links.push(link);
        }

        const runtime: OrbitRuntime = { renderer, camera, scene: scene3d, orbitGroup, nodes, links };
        runtimeRef.current = runtime;

        const resize = () => {
          const width = Math.max(1, host.clientWidth);
          const height = Math.max(1, host.clientHeight);
          renderer.setSize(width, height, false);
          camera.aspect = width / height;
          camera.updateProjectionMatrix();
          renderOrbit(runtime, currentTime, activeIndex);
        };
        resizeObserver = new ResizeObserver(resize);
        resizeObserver.observe(host);
        resize();
      } catch {
        host.dataset.webgl = "unavailable";
      }
    }

    void setup();
    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
      const runtime = runtimeRef.current;
      runtime?.nodes.forEach((node) => {
        node.geometry.dispose();
        (node.material as import("three").Material).dispose();
      });
      runtime?.links.forEach((link) => {
        link.geometry.dispose();
        (link.material as import("three").Material).dispose();
      });
      runtime?.renderer.dispose();
      runtimeRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (runtimeRef.current) renderOrbit(runtimeRef.current, currentTime, activeIndex);
  }, [activeIndex, currentTime]);

  return (
    <div className="spatial-orbit-preview" ref={hostRef} data-playing={isPlaying} data-engine="three.js">
      <div className="spatial-orbit-presenter" aria-hidden="true">
        <span className="spatial-orbit-presenter-head" />
        <span className="spatial-orbit-presenter-body" />
      </div>
      <canvas ref={canvasRef} aria-hidden="true" />
      <div className="spatial-orbit-fallback" aria-hidden="true">
        {[0, 1, 2, 3].map((index) => <i className={index === activeIndex ? "is-active" : ""} key={index} />)}
      </div>
      <div className="spatial-orbit-copy" aria-live="polite">
        <span className="spatial-orbit-kicker"><Orbit size={14} /> {scene.label}</span>
        <strong>{scene.title}</strong>
        <span>{scene.description}</span>
        <em>{scene.metric}</em>
      </div>
      <span className="spatial-orbit-engine">THREE.JS / WEBGL · SEEK SAFE</span>
    </div>
  );
}
