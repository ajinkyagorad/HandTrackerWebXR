'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { ARButton } from 'three/addons/webxr/ARButton.js';

const jointConnections = [
  ['wrist', 'thumb-metacarpal'],
  ['thumb-metacarpal', 'thumb-phalanx-proximal'],
  ['thumb-phalanx-proximal', 'thumb-phalanx-distal'],
  ['thumb-phalanx-distal', 'thumb-tip'],

  ['wrist', 'index-finger-metacarpal'],
  ['index-finger-metacarpal', 'index-finger-phalanx-proximal'],
  ['index-finger-phalanx-proximal', 'index-finger-phalanx-intermediate'],
  ['index-finger-phalanx-intermediate', 'index-finger-phalanx-distal'],
  ['index-finger-phalanx-distal', 'index-finger-tip'],

  ['wrist', 'middle-finger-metacarpal'],
  ['middle-finger-metacarpal', 'middle-finger-phalanx-proximal'],
  ['middle-finger-phalanx-proximal', 'middle-finger-phalanx-intermediate'],
  ['middle-finger-phalanx-intermediate', 'middle-finger-phalanx-distal'],
  ['middle-finger-phalanx-distal', 'middle-finger-tip'],

  ['wrist', 'ring-finger-metacarpal'],
  ['ring-finger-metacarpal', 'ring-finger-phalanx-proximal'],
  ['ring-finger-phalanx-proximal', 'ring-finger-phalanx-intermediate'],
  ['ring-finger-phalanx-intermediate', 'ring-finger-phalanx-distal'],
  ['ring-finger-phalanx-distal', 'ring-finger-tip'],

  ['wrist', 'pinky-finger-metacarpal'],
  ['pinky-finger-metacarpal', 'pinky-finger-phalanx-proximal'],
  ['pinky-finger-phalanx-proximal', 'pinky-finger-phalanx-intermediate'],
  ['pinky-finger-phalanx-intermediate', 'pinky-finger-phalanx-distal'],
  ['pinky-finger-phalanx-distal', 'pinky-finger-tip'],
];

class Trail {
  positions: THREE.Vector3[] = [];
  geometry: THREE.BufferGeometry;
  material: THREE.LineBasicMaterial;
  line: THREE.Line;
  maxPositions = 500;
  posArray: Float32Array;

  constructor(color: number) {
    this.geometry = new THREE.BufferGeometry();
    this.posArray = new Float32Array(this.maxPositions * 3);
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.posArray, 3));
    this.geometry.setDrawRange(0, 0);
    this.material = new THREE.LineBasicMaterial({ color: color, linewidth: 3 });
    this.line = new THREE.Line(this.geometry, this.material);
    this.line.frustumCulled = false;
  }

  update(position: THREE.Vector3, length: number) {
    this.positions.push(position.clone());
    
    // Ensure we don't exceed maxPositions
    const actualLength = Math.min(length, this.maxPositions);
    
    while (this.positions.length > actualLength) {
      this.positions.shift();
    }
    
    const count = this.positions.length;
    if (count < 2) {
      this.geometry.setDrawRange(0, 0);
      return;
    }
    
    for (let i = 0; i < count; i++) {
      this.posArray[i * 3] = this.positions[i].x;
      this.posArray[i * 3 + 1] = this.positions[i].y;
      this.posArray[i * 3 + 2] = this.positions[i].z;
    }
    
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.setDrawRange(0, count);
  }

  clear() {
    this.positions = [];
    this.geometry.setDrawRange(0, 0);
  }
}

export default function XRCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const [trailLength, setTrailLength] = useState(50);
  const trailLengthRef = useRef(50);

  useEffect(() => {
    trailLengthRef.current = trailLength;
  }, [trailLength]);

  useEffect(() => {
    if (!containerRef.current || !overlayRef.current) return;

    const container = containerRef.current;
    
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 20);
    
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.xr.enabled = true;
    container.appendChild(renderer.domElement);

    const light = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1);
    light.position.set(0.5, 1, 0.25);
    scene.add(light);

    const button = ARButton.createButton(renderer, {
      requiredFeatures: ['hand-tracking'],
      optionalFeatures: ['dom-overlay'],
      domOverlay: { root: overlayRef.current }
    });
    document.body.appendChild(button);

    // Controllers
    const controller1 = renderer.xr.getController(0);
    scene.add(controller1);
    const controller2 = renderer.xr.getController(1);
    scene.add(controller2);

    // Hands
    const hand1 = renderer.xr.getHand(0);
    scene.add(hand1);
    const hand2 = renderer.xr.getHand(1);
    scene.add(hand2);

    // Stick Figures
    const handMaterial = new THREE.LineBasicMaterial({ color: 0x00ff00, linewidth: 2 });
    
    function createStickFigure() {
      const geometry = new THREE.BufferGeometry();
      const positions = new Float32Array(jointConnections.length * 2 * 3);
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      return new THREE.LineSegments(geometry, handMaterial);
    }

    const stickFigure1 = createStickFigure();
    hand1.add(stickFigure1);
    const stickFigure2 = createStickFigure();
    hand2.add(stickFigure2);

    // Controller Cubes
    const cubeGeo = new THREE.BoxGeometry(0.05, 0.05, 0.1);
    const cubeMat = new THREE.MeshNormalMaterial();
    const cube1 = new THREE.Mesh(cubeGeo, cubeMat);
    controller1.add(cube1);
    const cube2 = new THREE.Mesh(cubeGeo, cubeMat);
    controller2.add(cube2);

    // Trails
    const trail1 = new Trail(0xff0000); // Red
    scene.add(trail1.line);
    const trail2 = new Trail(0x0000ff); // Blue
    scene.add(trail2.line);

    let c1Active = false;
    let c2Active = false;

    controller1.addEventListener('connected', () => { c1Active = true; });
    controller1.addEventListener('disconnected', () => { c1Active = false; trail1.clear(); });
    controller2.addEventListener('connected', () => { c2Active = true; });
    controller2.addEventListener('disconnected', () => { c2Active = false; trail2.clear(); });

    function updateStickFigure(hand: any, stickFigure: THREE.LineSegments) {
      if (!hand.joints || Object.keys(hand.joints).length === 0) {
        stickFigure.visible = false;
        return;
      }
      stickFigure.visible = true;
      
      const positions = stickFigure.geometry.attributes.position.array as Float32Array;
      let i = 0;
      for (const [j1, j2] of jointConnections) {
        const joint1 = hand.joints[j1];
        const joint2 = hand.joints[j2];
        if (joint1 && joint2) {
          positions[i++] = joint1.position.x;
          positions[i++] = joint1.position.y;
          positions[i++] = joint1.position.z;
          
          positions[i++] = joint2.position.x;
          positions[i++] = joint2.position.y;
          positions[i++] = joint2.position.z;
        } else {
          positions[i++] = 0; positions[i++] = 0; positions[i++] = 0;
          positions[i++] = 0; positions[i++] = 0; positions[i++] = 0;
        }
      }
      stickFigure.geometry.attributes.position.needsUpdate = true;
    }

    function updateTrail(hand: any, controller: THREE.Group, trail: Trail, isActive: boolean, cube: THREE.Mesh) {
      if (!isActive) return;
      
      const length = trailLengthRef.current;
      const targetPos = new THREE.Vector3();
      
      if (hand.joints && Object.keys(hand.joints).length > 0) {
        cube.visible = false;
        const wrist = hand.joints['wrist'];
        if (wrist) {
          wrist.getWorldPosition(targetPos);
          trail.update(targetPos, length);
        }
      } else {
        cube.visible = true;
        controller.getWorldPosition(targetPos);
        trail.update(targetPos, length);
      }
    }

    renderer.setAnimationLoop(() => {
      updateStickFigure(hand1, stickFigure1);
      updateStickFigure(hand2, stickFigure2);
      
      updateTrail(hand1, controller1, trail1, c1Active, cube1);
      updateTrail(hand2, controller2, trail2, c2Active, cube2);
      
      renderer.render(scene, camera);
    });

    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      renderer.setAnimationLoop(null);
      window.removeEventListener('resize', handleResize);
      container.removeChild(renderer.domElement);
      if (document.body.contains(button)) {
        document.body.removeChild(button);
      }
      renderer.dispose();
    };
  }, []);

  return (
    <>
      <div ref={containerRef} className="absolute inset-0 z-0" />
      
      {/* DOM Overlay for AR */}
      <div ref={overlayRef} className="absolute inset-0 pointer-events-none z-10 flex flex-col justify-end p-6">
        <div className="bg-black/50 p-4 rounded-xl backdrop-blur-md max-w-sm pointer-events-auto">
          <label className="text-white font-medium mb-2 block">
            Trail Length: {trailLength}
          </label>
          <input
            type="range"
            min="10"
            max="200"
            value={trailLength}
            onChange={(e) => setTrailLength(Number(e.target.value))}
            className="w-full accent-emerald-500"
          />
          <p className="text-white/70 text-sm mt-2">
            Adjust the length of the hand/controller trail.
          </p>
        </div>
      </div>
    </>
  );
}
