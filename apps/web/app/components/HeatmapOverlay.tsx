"use client";

interface HeatmapOverlayProps {
  screenshotBase64: string;
  heatmapData: any;
}

export default function HeatmapOverlay({ screenshotBase64, heatmapData }: HeatmapOverlayProps) {
  const [showOverlay, setShowOverlay] = useState(true);

  return (
    <div className="heatmap-container">
      <button
        className="heatmap-toggle"
        onClick={() => setShowOverlay(!showOverlay)}
      >
        {showOverlay ? '🔥 Hide Heatmap' : '🔥 Show Heatmap'}
      </button>

      <img
        className="heatmap-image"
        src={`data:image/png;base64,${screenshotBase64}`}
        alt="Page screenshot with heatmap overlay"
      />

      {showOverlay && heatmapData?.gradientStops && (
        <div
          className="heatmap-overlay"
          style={{
            background: heatmapData.gradientStops
              .map((stop: any) =>
                `radial-gradient(circle ${stop.radius}% at ${stop.x}% ${stop.y}%, ${stop.color}${Math.round(stop.opacity * 255).toString(16).padStart(2, '0')} 0%, transparent 100%)`
              )
              .join(', '),
          }}
        />
      )}

      {showOverlay && heatmapData?.hotspots?.map((hotspot: any, i: number) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: `${((hotspot.col + 0.5) / 5) * 100}%`,
            top: `${((hotspot.row + 0.5) / 5) * 100}%`,
            transform: 'translate(-50%, -50%)',
            padding: '4px 10px',
            background: 'rgba(0,0,0,0.8)',
            borderRadius: '20px',
            fontSize: '11px',
            color: hotspot.color || '#ff3366',
            border: `1px solid ${hotspot.color || '#ff3366'}`,
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          🖱️ {hotspot.element}
        </div>
      ))}
    </div>
  );
}

import { useState } from 'react';
