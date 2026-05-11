/**
 * UX Auditor — AI Analysis Engine
 * 
 * Uses GPT-4o Vision to analyze screenshots and collected data,
 * producing structured UX evaluations, heatmap predictions,
 * and actionable design recommendations.
 */

const OpenAI = require('openai');
const { UX_ANALYSIS_PROMPT, HEATMAP_PROMPT, DEV_ANALYSIS_PROMPT } = require('./prompts');
const { UX_REPORT_SCHEMA, HEATMAP_SCHEMA } = require('./schema');
const { generateHeatmapData } = require('./heatmap');

/**
 * Run full AI analysis on collected page data.
 * 
 * @param {Array} pageResults — array of collected data per page
 * @returns {object} AI analysis results
 */
async function analyzeUX(pageResults) {
  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const results = {
    pages: [],
    overall: null,
    heatmaps: [],
  };

  // ── Analyze each page ────────────────────────────────────
  for (const pageData of pageResults) {
    if (pageData.error) {
      results.pages.push({
        url: pageData.url,
        error: pageData.error,
        uxAnalysis: null,
        devAnalysis: null,
      });
      continue;
    }

    try {
      // 1. UX Analysis (Vision — screenshot + context)
      const uxAnalysis = await analyzePageUX(client, pageData);

      // 2. Dev Analysis (structured data)
      const devAnalysis = await analyzePageDev(client, pageData);

      // 3. Heatmap prediction
      let heatmap = null;
      if (pageData.data?.screenshots?.viewport) {
        heatmap = await predictHeatmap(client, pageData);
        results.heatmaps.push({
          url: pageData.url,
          heatmap,
        });
      }

      results.pages.push({
        url: pageData.url,
        title: pageData.title,
        uxAnalysis,
        devAnalysis,
        heatmap,
      });
    } catch (err) {
      console.error(`[Analyzer] Error analyzing ${pageData.url}:`, err.message);
      results.pages.push({
        url: pageData.url,
        title: pageData.title,
        error: err.message,
        uxAnalysis: null,
        devAnalysis: null,
      });
    }
  }

  // ── Overall site analysis ────────────────────────────────
  try {
    results.overall = await analyzeOverall(client, results.pages);
  } catch (err) {
    console.error('[Analyzer] Overall analysis error:', err.message);
    results.overall = { error: err.message };
  }

  return results;
}

/**
 * Analyze a single page's UX using GPT-4o Vision.
 */
async function analyzePageUX(client, pageData) {
  const screenshot = pageData.data?.screenshots?.viewport || pageData.data?.screenshots?.fullPage;

  if (!screenshot) {
    return { error: 'No screenshot available for analysis.' };
  }

  // Build context from collected data
  const context = buildContextString(pageData);

  const messages = [
    {
      role: 'system',
      content: UX_ANALYSIS_PROMPT,
    },
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text: `Analyze this webpage for UX quality.\n\nURL: ${pageData.url}\nTitle: ${pageData.title}\n\nCollected Context:\n${context}`,
        },
        {
          type: 'image_url',
          image_url: {
            url: `data:image/png;base64,${screenshot}`,
            detail: 'high',
          },
        },
      ],
    },
  ];

  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    messages,
    max_tokens: 2000,
    temperature: 0.3,
    response_format: { type: 'json_object' },
  });

  try {
    return JSON.parse(response.choices[0].message.content);
  } catch {
    return { rawResponse: response.choices[0].message.content };
  }
}

/**
 * Analyze page for dev-mode issues.
 */
async function analyzePageDev(client, pageData) {
  const devContext = {
    consoleErrors: pageData.data?.console?.errors || [],
    consoleWarnings: pageData.data?.console?.warnings || [],
    networkFailures: pageData.data?.network?.failed || [],
    slowResources: pageData.data?.network?.slow || [],
    accessibilityViolations: pageData.data?.accessibility?.violations || [],
    performanceMetrics: pageData.data?.performance?.webVitals || {},
    brokenInteractions: (pageData.simulation?.interactions || [])
      .filter((i) => i.status === 'fail')
      .map((i) => ({
        element: i.element?.text || i.element?.selector,
        error: i.error,
      })),
    domIssues: {
      headingIssues: pageData.data?.dom?.headingHierarchyValid?.issues || [],
      missingAltImages: pageData.data?.dom?.images?.missingAlt || 0,
      unsafeExternalLinks: pageData.data?.dom?.links?.unsafeNewTab || 0,
    },
  };

  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: DEV_ANALYSIS_PROMPT,
      },
      {
        role: 'user',
        content: `Analyze the following technical data from ${pageData.url} and produce a developer-focused report:\n\n${JSON.stringify(devContext, null, 2)}`,
      },
    ],
    max_tokens: 1500,
    temperature: 0.2,
    response_format: { type: 'json_object' },
  });

  try {
    return JSON.parse(response.choices[0].message.content);
  } catch {
    return { rawResponse: response.choices[0].message.content };
  }
}

/**
 * Predict user attention heatmap from screenshot.
 */
async function predictHeatmap(client, pageData) {
  const screenshot = pageData.data?.screenshots?.viewport;
  if (!screenshot) return null;

  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: HEATMAP_PROMPT,
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Predict where users will look and click on this webpage. Output attention zones as a JSON grid.',
          },
          {
            type: 'image_url',
            image_url: {
              url: `data:image/png;base64,${screenshot}`,
              detail: 'high',
            },
          },
        ],
      },
    ],
    max_tokens: 1000,
    temperature: 0.3,
    response_format: { type: 'json_object' },
  });

  try {
    const heatmapData = JSON.parse(response.choices[0].message.content);
    return generateHeatmapData(heatmapData);
  } catch {
    return null;
  }
}

/**
 * Generate overall site analysis from individual page results.
 */
async function analyzeOverall(client, pageAnalyses) {
  const validPages = pageAnalyses.filter((p) => p.uxAnalysis && !p.error);

  if (validPages.length === 0) {
    return { error: 'No pages successfully analyzed.' };
  }

  const summaries = validPages.map((p) => ({
    url: p.url,
    title: p.title,
    scores: p.uxAnalysis?.scores || p.uxAnalysis?.categories || {},
    topIssues: (p.uxAnalysis?.issues || []).slice(0, 3),
  }));

  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: `You are a senior UX consultant writing an executive summary of a full website audit. 
Synthesize the per-page analyses into an overall assessment. Be specific, actionable, and honest.
Output as JSON with keys: overallScore (1-10), verdict ("Poor"/"Fair"/"Good"/"Excellent"), 
summary (2-3 sentences), strengths (array of strings), weaknesses (array of strings), 
topRecommendations (array of {priority: "high"/"medium"/"low", title: string, description: string}).`,
      },
      {
        role: 'user',
        content: `Here are the per-page UX analysis results for a website audit:\n\n${JSON.stringify(summaries, null, 2)}`,
      },
    ],
    max_tokens: 1000,
    temperature: 0.3,
    response_format: { type: 'json_object' },
  });

  try {
    return JSON.parse(response.choices[0].message.content);
  } catch {
    return { rawResponse: response.choices[0].message.content };
  }
}

/**
 * Build a context string from collected page data for the LLM.
 */
function buildContextString(pageData) {
  const parts = [];

  // Interaction summary
  if (pageData.simulation?.summary) {
    const s = pageData.simulation.summary;
    parts.push(`Interactive Elements: ${s.totalElements} total`);
    parts.push(`Click Results: ${s.successfulClicks} success, ${s.failedClicks} failed`);
    parts.push(`Forms Found: ${s.formsFound}`);
  }

  // Accessibility summary
  if (pageData.data?.accessibility?.summary) {
    const a = pageData.data.accessibility.summary;
    parts.push(`Accessibility: ${a.totalViolations} violations (${a.critical} critical, ${a.serious} serious)`);
    parts.push(`Accessibility Score: ${pageData.data.accessibility.score}/100`);
  }

  // Performance summary
  if (pageData.data?.performance?.webVitals) {
    const p = pageData.data.performance.webVitals;
    parts.push(`Performance — FCP: ${p.fcp}ms, LCP: ${p.lcp}ms, CLS: ${p.cls}, TBT: ${p.tbt}ms`);
  }

  // DOM summary
  if (pageData.data?.dom) {
    const d = pageData.data.dom;
    parts.push(`DOM Elements: ${d.totalElements}`);
    parts.push(`Images: ${d.images?.total || 0} total, ${d.images?.missingAlt || 0} missing alt`);
    parts.push(`Links: ${d.links?.total || 0} total, ${d.links?.noText || 0} without text`);
    if (d.headingHierarchyValid?.issues?.length > 0) {
      parts.push(`Heading Issues: ${d.headingHierarchyValid.issues.join('; ')}`);
    }
  }

  // Console errors
  if (pageData.data?.console?.errors?.length > 0) {
    parts.push(`Console Errors: ${pageData.data.console.errors.length}`);
  }

  return parts.join('\n');
}

module.exports = { analyzeUX };
