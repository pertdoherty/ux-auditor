/**
 * Scoring Algorithms
 * 
 * Calculates unified scores from AI analysis + rule-based data.
 */

/**
 * Calculate combined scores from all analysis sources.
 * 
 * @param {object} analysis — AI analysis results
 * @param {Array} pageResults — raw page data
 * @returns {object} unified scores
 */
function calculateScores(analysis, pageResults) {
  const scores = {
    overall: 0,
    verdict: 'Fair',
    categories: {
      visualDesign: { score: 0, weight: 0.20 },
      navigation: { score: 0, weight: 0.15 },
      contentClarity: { score: 0, weight: 0.15 },
      accessibility: { score: 0, weight: 0.15 },
      performance: { score: 0, weight: 0.15 },
      mobileUX: { score: 0, weight: 0.10 },
      trustCredibility: { score: 0, weight: 0.05 },
      interactionDesign: { score: 0, weight: 0.05 },
    },
  };

  // ── Aggregate AI scores across pages ─────────────────────
  const aiScores = {};
  let pageCount = 0;

  for (const page of (analysis.pages || [])) {
    if (!page.uxAnalysis?.categories) continue;
    pageCount++;

    for (const cat of page.uxAnalysis.categories) {
      const key = normalizeCategoryName(cat.name);
      if (!aiScores[key]) aiScores[key] = [];
      aiScores[key].push(cat.score);
    }
  }

  // Average AI scores per category
  const categoryMap = {
    visualDesign: ['visual design', 'visual', 'design', 'aesthetics'],
    navigation: ['navigation', 'navigation & flow', 'flow'],
    contentClarity: ['content', 'content clarity', 'readability'],
    accessibility: ['accessibility'],
    performance: ['performance', 'performance ux', 'speed'],
    mobileUX: ['mobile', 'mobile responsiveness', 'responsive'],
    trustCredibility: ['trust', 'trust & credibility', 'credibility'],
    interactionDesign: ['interaction', 'interaction design', 'interactions'],
  };

  for (const [key, aliases] of Object.entries(categoryMap)) {
    const matchingScores = [];
    for (const alias of aliases) {
      if (aiScores[alias]) {
        matchingScores.push(...aiScores[alias]);
      }
    }
    if (matchingScores.length > 0) {
      scores.categories[key].score = average(matchingScores);
    }
  }

  // ── Supplement with rule-based scores ────────────────────
  // Accessibility: use axe-core score if available
  const a11yScores = pageResults
    .filter((p) => p.data?.accessibility?.score !== undefined)
    .map((p) => p.data.accessibility.score / 10); // Convert 0-100 to 0-10
  if (a11yScores.length > 0) {
    const ruleBasedA11y = average(a11yScores);
    // Blend AI score (60%) with rule-based (40%)
    scores.categories.accessibility.score =
      scores.categories.accessibility.score * 0.6 + ruleBasedA11y * 0.4;
  }

  // Performance: use Web Vitals score if available
  const perfScores = pageResults
    .filter((p) => p.data?.performance?.score !== undefined)
    .map((p) => p.data.performance.score / 10);
  if (perfScores.length > 0) {
    const ruleBasedPerf = average(perfScores);
    scores.categories.performance.score =
      scores.categories.performance.score * 0.5 + ruleBasedPerf * 0.5;
  }

  // ── Calculate weighted overall score ─────────────────────
  let weightedSum = 0;
  let totalWeight = 0;

  for (const cat of Object.values(scores.categories)) {
    if (cat.score > 0) {
      weightedSum += cat.score * cat.weight;
      totalWeight += cat.weight;
    }
  }

  scores.overall = totalWeight > 0
    ? Math.round((weightedSum / totalWeight) * 10) / 10
    : (analysis.overall?.overallScore || 5);

  // Use AI overall if our calculated score seems off
  if (analysis.overall?.overallScore && Math.abs(scores.overall - analysis.overall.overallScore) > 2) {
    // Blend: 70% calculated, 30% AI overall
    scores.overall = Math.round((scores.overall * 0.7 + analysis.overall.overallScore * 0.3) * 10) / 10;
  }

  // ── Verdict ──────────────────────────────────────────────
  scores.verdict = getVerdict(scores.overall);

  return scores;
}

function getVerdict(score) {
  if (score >= 8.5) return 'Excellent';
  if (score >= 7.0) return 'Good';
  if (score >= 5.0) return 'Fair';
  return 'Poor';
}

function normalizeCategoryName(name) {
  return (name || '').toLowerCase().trim();
}

function average(arr) {
  if (arr.length === 0) return 0;
  return Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10;
}

module.exports = { calculateScores };
