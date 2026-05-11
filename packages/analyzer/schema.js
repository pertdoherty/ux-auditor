/**
 * JSON Schema definitions for AI analysis outputs.
 * Used to validate and structure GPT-4o responses.
 */

const UX_REPORT_SCHEMA = {
  type: 'object',
  properties: {
    overallScore: { type: 'number', minimum: 1, maximum: 10 },
    categories: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          score: { type: 'number', minimum: 1, maximum: 10 },
          assessment: { type: 'string' },
          suggestions: { type: 'array', items: { type: 'string' } },
        },
      },
    },
    issues: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          severity: { type: 'string', enum: ['high', 'medium', 'low'] },
          title: { type: 'string' },
          description: { type: 'string' },
          recommendation: { type: 'string' },
          category: { type: 'string' },
        },
      },
    },
    strengths: { type: 'array', items: { type: 'string' } },
    overallAssessment: { type: 'string' },
  },
};

const HEATMAP_SCHEMA = {
  type: 'object',
  properties: {
    grid: {
      type: 'array',
      items: {
        type: 'array',
        items: { type: 'number', minimum: 0, maximum: 100 },
      },
    },
    primaryFocalPoint: {
      type: 'object',
      properties: {
        gridRow: { type: 'number' },
        gridCol: { type: 'number' },
        element: { type: 'string' },
      },
    },
    clickHotspots: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          gridRow: { type: 'number' },
          gridCol: { type: 'number' },
          element: { type: 'string' },
          confidence: { type: 'number' },
        },
      },
    },
    frictionPoints: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          gridRow: { type: 'number' },
          gridCol: { type: 'number' },
          element: { type: 'string' },
          reason: { type: 'string' },
        },
      },
    },
  },
};

const DEV_REPORT_SCHEMA = {
  type: 'object',
  properties: {
    totalIssues: { type: 'number' },
    bugs: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          severity: { type: 'string', enum: ['critical', 'warning', 'info'] },
          title: { type: 'string' },
          details: { type: 'string' },
          fix: { type: 'string' },
          category: { type: 'string' },
        },
      },
    },
    performanceSummary: {
      type: 'object',
      properties: {
        grade: { type: 'string' },
        highlights: { type: 'array', items: { type: 'string' } },
        improvements: { type: 'array', items: { type: 'string' } },
      },
    },
    accessibilitySummary: {
      type: 'object',
      properties: {
        wcagLevel: { type: 'string' },
        passRate: { type: 'string' },
        criticalFixes: { type: 'array', items: { type: 'string' } },
      },
    },
  },
};

module.exports = {
  UX_REPORT_SCHEMA,
  HEATMAP_SCHEMA,
  DEV_REPORT_SCHEMA,
};
