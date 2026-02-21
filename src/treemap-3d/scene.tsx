import { FunctionalComponent } from "preact";
import { useContext, useEffect, useRef } from "preact/hooks";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { HierarchyRectangularNode } from "d3-hierarchy";

import { ModuleTree, ModuleTreeLeaf, SizeKey } from "../../shared/types";
import { StaticContext } from "./index";

interface Treemap3DSceneProps {
  root: HierarchyRectangularNode<ModuleTree | ModuleTreeLeaf>;
  sizeProperty: SizeKey;
  selectedNode: HierarchyRectangularNode<ModuleTree | ModuleTreeLeaf> | undefined;
  onNodeHover: (node: HierarchyRectangularNode<ModuleTree | ModuleTreeLeaf> | undefined) => void;
  onNodeClick: (node: HierarchyRectangularNode<ModuleTree | ModuleTreeLeaf>) => void;
}

type TreemapNodeMesh = THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial> & {
  userData: {
    node: HierarchyRectangularNode<ModuleTree | ModuleTreeLeaf>;
  };
};

export const Treemap3DScene: FunctionalComponent<Treemap3DSceneProps> = ({
  root,
  sizeProperty,
  selectedNode,
  onNodeHover,
  onNodeClick,
}) => {
  const { width, height, getModuleSize, getModuleColor } = useContext(StaticContext);
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (host == null) {
      return;
    }

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#2b2d42");

    const sceneExtent = Math.max(width, height);
    const camera = new THREE.PerspectiveCamera(
      45,
      width / height,
      Math.max(1, sceneExtent * 0.01),
      sceneExtent * 8,
    );
    const distance = sceneExtent * 1.25;
    camera.position.set(width * 0.5, distance, height * 1.1);
    camera.lookAt(width * 0.5, 0, height * 0.5);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    host.append(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = true;
    controls.minDistance = sceneExtent * 0.15;
    controls.maxDistance = sceneExtent * 4;
    controls.maxPolarAngle = Math.PI * 0.49;
    controls.target.set(width * 0.5, 0, height * 0.5);
    controls.update();

    scene.add(new THREE.AmbientLight(0xffffff, 0.45));

    const directLight = new THREE.DirectionalLight(0xffffff, 0.7);
    directLight.position.set(width, Math.max(width, height), height * 0.5);
    directLight.castShadow = true;
    directLight.shadow.mapSize.width = 2048;
    directLight.shadow.mapSize.height = 2048;
    directLight.shadow.camera.near = 1;
    directLight.shadow.camera.far = sceneExtent * 5;
    directLight.shadow.camera.left = -sceneExtent;
    directLight.shadow.camera.right = sceneExtent;
    directLight.shadow.camera.top = sceneExtent;
    directLight.shadow.camera.bottom = -sceneExtent;
    scene.add(directLight);

    const pointLight = new THREE.PointLight(0xffffff, 0.45, sceneExtent * 4);
    pointLight.position.set(width * 0.7, Math.max(width, height) * 0.8, height * 0.2);
    pointLight.castShadow = true;
    pointLight.shadow.mapSize.width = 1024;
    pointLight.shadow.mapSize.height = 1024;
    pointLight.shadow.camera.near = 1;
    pointLight.shadow.camera.far = sceneExtent * 4;
    scene.add(pointLight);

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(width * 1.4, height * 1.4),
      new THREE.MeshStandardMaterial({
        color: "#1f2032",
        roughness: 0.95,
        metalness: 0,
      }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(width * 0.5, -0.6, height * 0.5);
    floor.receiveShadow = true;
    scene.add(floor);

    const descendants = root
      .descendants()
      .filter((node) => node !== root)
      .filter((node) => node.x1 > node.x0 && node.y1 > node.y0);

    const maxDepth = Math.max(...descendants.map((node) => node.depth), 1);
    const layerStep = 14;
    const platformHeight = 2.5;

    const leafNodes = descendants.filter((node) => node.children == null);
    const maxLeafSize = Math.max(
      ...leafNodes.map((node) => getModuleSize(node.data, sizeProperty)),
      1,
    );
    const getLeafExtrudeHeight = (size: number) => 8 + Math.sqrt(size / maxLeafSize) * 90;

    const meshes: TreemapNodeMesh[] = descendants.map((node) => {
      const inset = 0.8;
      const w = Math.max(0.2, node.x1 - node.x0 - inset);
      const d = Math.max(0.2, node.y1 - node.y0 - inset);
      const isLeaf = node.children == null;
      const h = isLeaf
        ? getLeafExtrudeHeight(getModuleSize(node.data, sizeProperty))
        : platformHeight;
      const baseY = node.depth * layerStep;

      const geometry = new THREE.BoxGeometry(w, h, d);
      const nodeColor = getModuleColor(node).backgroundColor;
      const depthRatio = node.depth / maxDepth;
      const material = new THREE.MeshStandardMaterial({
        color: nodeColor,
        roughness: isLeaf ? 0.72 : 0.92,
        metalness: isLeaf ? 0.14 : 0.02,
        transparent: !isLeaf,
        opacity: isLeaf ? 1 : 0.25 + depthRatio * 0.2,
        polygonOffset: true,
        polygonOffsetFactor: 1,
        polygonOffsetUnits: 1,
      });

      if (selectedNode === node) {
        material.emissive = new THREE.Color("#ffffff");
        material.emissiveIntensity = 0.35;
      }

      const mesh = new THREE.Mesh(geometry, material) as TreemapNodeMesh;
      mesh.position.set((node.x0 + node.x1) * 0.5, baseY + h * 0.5, (node.y0 + node.y1) * 0.5);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData = { node };
      scene.add(mesh);
      return mesh;
    });

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let isDraggingControls = false;
    let pointerDownPos: { x: number; y: number } | undefined;

    let hoveredMesh: TreemapNodeMesh | undefined;

    const pickMesh = (event: MouseEvent): TreemapNodeMesh | undefined => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(meshes, false)[0];
      return hit?.object as TreemapNodeMesh | undefined;
    };

    const clearHover = () => {
      if (hoveredMesh == null) {
        return;
      }
      if (hoveredMesh.userData.node !== selectedNode) {
        hoveredMesh.material.emissiveIntensity = 0;
      }
      hoveredMesh = undefined;
      onNodeHover(undefined);
    };

    const onMouseMove = (event: MouseEvent) => {
      if (isDraggingControls) {
        clearHover();
        return;
      }

      const mesh = pickMesh(event);

      if (mesh === hoveredMesh) {
        return;
      }

      clearHover();
      if (mesh == null) {
        return;
      }

      hoveredMesh = mesh;
      mesh.material.emissive = new THREE.Color("#ffffff");
      mesh.material.emissiveIntensity = 0.22;
      onNodeHover(mesh.userData.node);
    };

    const onClick = (event: MouseEvent) => {
      if (pointerDownPos != null) {
        const movement = Math.hypot(
          event.clientX - pointerDownPos.x,
          event.clientY - pointerDownPos.y,
        );
        if (movement > 4) {
          return;
        }
      }

      const mesh = pickMesh(event);
      if (mesh != null) {
        onNodeClick(mesh.userData.node);
      }
    };

    const onPointerDown = (event: MouseEvent) => {
      pointerDownPos = { x: event.clientX, y: event.clientY };
    };

    const onContextMenu = (event: MouseEvent) => {
      event.preventDefault();
    };

    const onControlsStart = () => {
      isDraggingControls = true;
      clearHover();
    };

    const onControlsEnd = () => {
      isDraggingControls = false;
    };

    controls.addEventListener("start", onControlsStart);
    controls.addEventListener("end", onControlsEnd);

    renderer.domElement.addEventListener("mousedown", onPointerDown);
    renderer.domElement.addEventListener("mousemove", onMouseMove);
    renderer.domElement.addEventListener("mouseleave", clearHover);
    renderer.domElement.addEventListener("click", onClick);
    renderer.domElement.addEventListener("contextmenu", onContextMenu);

    let frameId = 0;
    const draw = () => {
      controls.update();
      renderer.render(scene, camera);
      frameId = window.requestAnimationFrame(draw);
    };
    draw();

    return () => {
      window.cancelAnimationFrame(frameId);
      controls.removeEventListener("start", onControlsStart);
      controls.removeEventListener("end", onControlsEnd);
      controls.dispose();

      renderer.domElement.removeEventListener("mousedown", onPointerDown);
      renderer.domElement.removeEventListener("mousemove", onMouseMove);
      renderer.domElement.removeEventListener("mouseleave", clearHover);
      renderer.domElement.removeEventListener("click", onClick);
      renderer.domElement.removeEventListener("contextmenu", onContextMenu);

      for (const mesh of meshes) {
        mesh.geometry.dispose();
        mesh.material.dispose();
      }

      floor.geometry.dispose();
      (floor.material as THREE.Material).dispose();

      renderer.dispose();
      host.removeChild(renderer.domElement);
    };
  }, [
    getModuleColor,
    getModuleSize,
    height,
    onNodeClick,
    onNodeHover,
    root,
    selectedNode,
    sizeProperty,
    width,
  ]);

  return <div className="treemap-3d-canvas" ref={hostRef} />;
};
