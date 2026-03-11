'use client';

import dynamic from 'next/dynamic';

const XRCanvas = dynamic(() => import('@/components/XRCanvas'), { ssr: false });

export default function Home() {
  return (
    <main className="relative w-screen h-screen overflow-hidden bg-zinc-900">
      <div className="absolute inset-0 flex flex-col items-center justify-center z-20 pointer-events-none">
        <h1 className="text-4xl font-bold text-white mb-4 tracking-tight">WebXR Hand Tracker</h1>
        <p className="text-zinc-400 text-center max-w-md mb-8">
          Click &quot;ENTER AR&quot; below to start the passthrough experience.
          Use your hands or controllers to draw trails.
        </p>
      </div>
      <XRCanvas />
    </main>
  );
}
