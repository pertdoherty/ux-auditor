/**
 * Predictive Heatmap Generator
 * 
 * Transforms AI-predicted attention scores into a renderable
 * heatmap data structure for the frontend overlay.
 */

/**
 * Process raw AI heatmap prediction into renderable data.
 * 
 * @param {object} aiPrediction — raw GPT-4o heatmap output
 * @returns {object} processed heatmap data
 */
function generateHeatmapData(aiPrediction) {
  const result = {
    grid: [],
    hotspots: [],
    frictionPoints: [],
    focalPoint: null,
    gradientStops: [],
  };

  // ── Process grid ─────────────────────────────────────────
  if (aiPrediction.grid && Array.isArray(aiPrediction.grid)) {
    result.grid = aiPrediction.grid.map((row) =>
      row.map((score) => ({
        score: clamp(score, 0, 100),
        color: scoreToColor(clamp(score, 0, 100)),
        opacity: clamp(score, 0, 100) / 100,
      }))
    );
  } else {
    // Generate a default 5x5 grid if AI didn't return one
    result.grid = Array(5)
      .fill(null)
      .map(() =>
        Array(5)
          .fill(null)
          .map(() => ({
            score: 30,
            color: scoreToColor(30),
            opacity: 0.3,
          }))
      );
  }

  // ── Process hotspots ─────────────────────────────────────
  if (aiPrediction.clickHotspots) {
    result.hotspots = aiPrediction.clickHotspots.map((h) => ({
      row: h.gridRow,
      col: h.gridCol,
      element: h.element,
      confidence: h.confidence || 50,
      color: confidenceToColor(h.confidence || 50),
    }));
  }

  // ── Process friction points ──────────────────────────────
  if (aiPrediction.frictionPoints) {
    result.frictionPoints = aiPrediction.frictionPoints.map((f) => ({
      row: f.gridRow,
      col: f.gridCol,
      element: f.element,
      reason: f.reason,
    }));
  }

  // ── Focal point ──────────────────────────────────────────
  if (aiPrediction.primaryFocalPoint) {
    result.focalPoint = {
      row: aiPrediction.primaryFocalPoint.gridRow,
      col: aiPrediction.primaryFocalPoint.gridCol,
      element: aiPrediction.primaryFocalPoint.element,
    };
  }

  // ── Generate CSS gradient stops for overlay ──────────────
  result.gradientStops = generateGradientStops(result.grid);

  return result;
}

/**
 * Convert attention score (0-100) to a heatmap color.
 * Cold (blue) → Warm (yellow) → Hot (red)
 */
function scoreToColor(score) {
  if (score >= 80) return { r: 255, g: 0, b: 0, hex: '#ff0000' };       // Hot red
  if (score >= 60) return { r: 255, g: 140, b: 0, hex: '#ff8c00' };     // Orange
  if (score >= 40) return { r: 255, g: 255, b: 0, hex: '#ffff00' };     // Yellow
  if (score >= 20) return { r: 0, g: 200, b: 255, hex: '#00c8ff' };     // Light blue
  return { r: 0, g: 0, b: 255, hex: '#0000ff' };                         // Cold blue
}

/**
 * Convert confidence percentage to a color for click hotspots.
 */
function confidenceToColor(confidence) {
  if (confidence >= 80) return '#ff3366';
  if (confidence >= 60) return '#ff6b35';
  if (confidence >= 40) return '#ffc233';
  return '#33ccff';
}

/**
 * Generate CSS radial gradient stops for heatmap overlay rendering.
 */
function generateGradientStops(grid) {
  const stops = [];
  const rows = grid.length;
  const cols = grid[0]?.length || 5;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = grid[r][c];
      if (cell.score > 30) {
        // Only generate stops for significant attention areas
        const xPercent = ((c + 0.5) / cols) * 100;
        const yPercent = ((r + 0.5) / rows) * 100;
        const radius = Math.max(15, cell.score / 3);

        stops.push({
          x: xPercent,
          y: yPercent,
          radius,
          color: cell.color.hex,
          opacity: cell.opacity * 0.6, // Slightly transparent for overlay
        });
      }
    }
  }

  return stops;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

module.exports = { generateHeatmapData };
