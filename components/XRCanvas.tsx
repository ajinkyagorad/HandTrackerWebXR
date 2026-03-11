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

const jointNames = [
  'wrist',
  'thumb-metacarpal', 'thumb-phalanx-proximal', 'thumb-phalanx-distal', 'thumb-tip',
  'index-finger-metacarpal', 'index-finger-phalanx-proximal', 'index-finger-phalanx-intermediate', 'index-finger-phalanx-distal', 'index-finger-tip',
  'middle-finger-metacarpal', 'middle-finger-phalanx-proximal', 'middle-finger-phalanx-intermediate', 'middle-finger-phalanx-distal', 'middle-finger-tip',
  'ring-finger-metacarpal', 'ring-finger-phalanx-proximal', 'ring-finger-phalanx-intermediate', 'ring-finger-phalanx-distal', 'ring-finger-tip',
  'pinky-finger-metacarpal', 'pinky-finger-phalanx-proximal', 'pinky-finger-phalanx-intermediate', 'pinky-finger-phalanx-distal', 'pinky-finger-tip'
];

class Trail {
  positions: THREE.Vector3[] = [];
  geometry: THREE.BufferGeometry;
  material: THREE.LineBasicMaterial;
  line: THREE.Line;
  maxPositions = 1000;
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

class HeadsetTrail {
  maxPositions = 1000;
  shaftMesh: THREE.InstancedMesh;
  headMesh: THREE.InstancedMesh;
  positions: THREE.Vector3[] = [];
  quaternions: THREE.Quaternion[] = [];
  dummy = new THREE.Object3D();
  group = new THREE.Group();

  constructor() {
    // Thin shaft for the vector
    const shaftGeo = new THREE.CylinderGeometry(0.0015, 0.0015, 0.04);
    shaftGeo.rotateX(-Math.PI / 2);
    shaftGeo.translate(0, 0, -0.02);
    const shaftMat = new THREE.MeshBasicMaterial({ color: 0xaaaaaa, transparent: true, opacity: 0.2 });
    this.shaftMesh = new THREE.InstancedMesh(shaftGeo, shaftMat, this.maxPositions);
    this.shaftMesh.count = 0;
    this.shaftMesh.frustumCulled = false;

    // Small colored head for the vector
    const headGeo = new THREE.ConeGeometry(0.005, 0.015);
    headGeo.rotateX(-Math.PI / 2);
    headGeo.translate(0, 0, -0.0475); // Base at -0.04, tip at -0.055
    const headMat = new THREE.MeshBasicMaterial({ color: 0xff3333, transparent: true, opacity: 0.4 });
    this.headMesh = new THREE.InstancedMesh(headGeo, headMat, this.maxPositions);
    this.headMesh.count = 0;
    this.headMesh.frustumCulled = false;

    this.group.add(this.shaftMesh);
    this.group.add(this.headMesh);
  }

  update(position: THREE.Vector3, quaternion: THREE.Quaternion, length: number) {
    this.positions.push(position.clone());
    this.quaternions.push(quaternion.clone());
    
    const actualLength = Math.min(length, this.maxPositions);
    while (this.positions.length > actualLength) {
      this.positions.shift();
      this.quaternions.shift();
    }
    
    // Skip the most recent 15 frames so it doesn't block the immediate view
    const skipFrames = 15;
    const renderCount = Math.max(0, this.positions.length - skipFrames);
    
    this.shaftMesh.count = renderCount;
    this.headMesh.count = renderCount;

    for (let i = 0; i < renderCount; i++) {
      this.dummy.position.copy(this.positions[i]);
      this.dummy.quaternion.copy(this.quaternions[i]);
      
      // Scale down older parts of the trail
      const scale = 0.3 + 0.7 * (i / renderCount);
      this.dummy.scale.set(scale, scale, scale);
      this.dummy.updateMatrix();
      
      this.shaftMesh.setMatrixAt(i, this.dummy.matrix);
      this.headMesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.shaftMesh.instanceMatrix.needsUpdate = true;
    this.headMesh.instanceMatrix.needsUpdate = true;
  }

  clear() {
    this.positions = [];
    this.quaternions = [];
    this.shaftMesh.count = 0;
    this.headMesh.count = 0;
  }
}

export default function XRCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  
  const [sliderValue, setSliderValue] = useState(170); // 10^(1.7) ~= 50
  const [showAllJoints, setShowAllJoints] = useState(false);
  const [showHeadset, setShowHeadset] = useState(false);
  
  const trailLength = Math.floor(Math.pow(10, sliderValue / 100));
  
  const trailLengthRef = useRef(trailLength);
  const showAllJointsRef = useRef(showAllJoints);
  const showHeadsetRef = useRef(showHeadset);

  useEffect(() => {
    trailLengthRef.current = trailLength;
  }, [trailLength]);

  useEffect(() => {
    showAllJointsRef.current = showAllJoints;
  }, [showAllJoints]);

  useEffect(() => {
    showHeadsetRef.current = showHeadset;
  }, [showHeadset]);

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
    const createHandTrails = (color: number) => {
      const trails: Record<string, Trail> = {};
      jointNames.forEach(name => {
        const trail = new Trail(color);
        trails[name] = trail;
        scene.add(trail.line);
      });
      return trails;
    };

    const trails1 = createHandTrails(0xff0000); // Red
    const trails2 = createHandTrails(0x0000ff); // Blue

    const headsetTrail = new HeadsetTrail();
    scene.add(headsetTrail.group);

    let c1Active = false;
    let c2Active = false;

    controller1.addEventListener('connected', () => { c1Active = true; });
    controller1.addEventListener('disconnected', () => { 
      c1Active = false; 
      Object.values(trails1).forEach(t => t.clear()); 
    });
    controller2.addEventListener('connected', () => { c2Active = true; });
    controller2.addEventListener('disconnected', () => { 
      c2Active = false; 
      Object.values(trails2).forEach(t => t.clear()); 
    });

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

    function updateTrails(hand: any, controller: THREE.Group, trails: Record<string, Trail>, isActive: boolean, cube: THREE.Mesh) {
      if (!isActive) return;
      
      const length = trailLengthRef.current;
      const showAll = showAllJointsRef.current;
      const targetPos = new THREE.Vector3();
      
      if (hand.joints && Object.keys(hand.joints).length > 0) {
        cube.visible = false;
        for (const jointName of jointNames) {
          const trail = trails[jointName];
          if ((showAll || jointName === 'wrist') && hand.joints[jointName]) {
            hand.joints[jointName].getWorldPosition(targetPos);
            trail.update(targetPos, length);
          } else {
            trail.clear();
          }
        }
      } else {
        cube.visible = true;
        controller.getWorldPosition(targetPos);
        trails['wrist'].update(targetPos, length);
        for (const jointName of jointNames) {
          if (jointName !== 'wrist') trails[jointName].clear();
        }
      }
    }

    renderer.setAnimationLoop(() => {
      updateStickFigure(hand1, stickFigure1);
      updateStickFigure(hand2, stickFigure2);
      
      updateTrails(hand1, controller1, trails1, c1Active, cube1);
      updateTrails(hand2, controller2, trails2, c2Active, cube2);
      
      if (showHeadsetRef.current) {
        const xrCamera = renderer.xr.getCamera();
        headsetTrail.update(xrCamera.position, xrCamera.quaternion, trailLengthRef.current);
      } else {
        headsetTrail.clear();
      }
      
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
        <div className="bg-black/50 p-4 rounded-xl backdrop-blur-md max-w-sm pointer-events-auto flex flex-col gap-4">
          <div>
            <label className="text-white font-medium mb-2 block">
              Trail Length: {trailLength}
            </label>
            <input
              type="range"
              min="0"
              max="300"
              value={sliderValue}
              onChange={(e) => setSliderValue(Number(e.target.value))}
              className="w-full accent-emerald-500"
            />
            <p className="text-white/70 text-sm mt-1">
              Exponential scale (1 to 1000)
            </p>
          </div>

          <label className="flex items-center gap-3 text-white font-medium cursor-pointer">
            <input 
              type="checkbox" 
              checked={showAllJoints}
              onChange={(e) => setShowAllJoints(e.target.checked)}
              className="w-5 h-5 accent-emerald-500 rounded"
            />
            Show trails for all finger joints
          </label>

          <label className="flex items-center gap-3 text-white font-medium cursor-pointer">
            <input 
              type="checkbox" 
              checked={showHeadset}
              onChange={(e) => setShowHeadset(e.target.checked)}
              className="w-5 h-5 accent-emerald-500 rounded"
            />
            Show headset trail & orientation
          </label>
        </div>
      </div>
    </>
  );
}
