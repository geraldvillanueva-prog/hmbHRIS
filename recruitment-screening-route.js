// ============================================================================
// AI Applicant Screening — backend route
// ============================================================================
// Why this exists: the front-end (admin.html, "AI Screening" tab under
// Recruitment / ATS) calls POST /api/recruitment/screen. That call CANNOT go
// straight from the browser to Anthropic's API — the API key would be visible
// to anyone who opens dev tools on your admin panel, and Anthropic's API
// doesn't support being called from arbitrary browser origins for production
// multi-user apps. So this route lives on your existing Node/Express server
// and does the Anthropic call server-side, where the key stays private.
//
// SETUP:
// 1. npm install (in your server project, if not already present):
//      npm install node-fetch@2        (only if your Node version < 18)
// 2. Add your API key to the server's environment (.env or however you
//    already manage secrets — you already do this for other integrations):
//      ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxxxxxxxxxx
// 3. Mount this route in your main server file, e.g.:
//      const screeningRoute = require('./recruitment-screening-route');
//      app.use('/api/recruitment', screeningRoute);
// 4. Restart with pm2 as usual.
//
// COST NOTE: every click of "Screen" / "Re-screen" in the admin panel makes
// one Anthropic API call. There's no caching or rate-limiting built in here —
// add some if this gets used heavily (e.g. don't re-screen the same
// applicant+position pair more than once every few minutes).
// ============================================================================

const express = require('express');
const router = express.Router();

// Node 18+ has global fetch built in. If your server runs an older Node,
// uncomment the next line after installing node-fetch@2.
// const fetch = require('node-fetch');

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const ANTHROPIC_MODEL = 'claude-sonnet-4-6'; // update if you standardize on a different model string

router.post('/screen', async (req, res) => {
  try {
    if (!ANTHROPIC_API_KEY) {
      return res.status(500).json({ error: 'ANTHROPIC_API_KEY is not configured on the server.' });
    }

    const { applicant, position } = req.body || {};
    if (!applicant || !applicant.full_name) {
      return res.status(400).json({ error: 'Missing applicant data.' });
    }

    const prompt = buildScreeningPrompt(applicant, position);

    const anthropicResp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!anthropicResp.ok) {
      const errText = await anthropicResp.text().catch(() => '');
      console.error('Anthropic API error:', anthropicResp.status, errText);
      return res.status(502).json({ error: 'Anthropic API request failed: ' + anthropicResp.status });
    }

    const data = await anthropicResp.json();
    const textBlock = (data.content || []).find(b => b.type === 'text');
    if (!textBlock) {
      return res.status(502).json({ error: 'No text response from Anthropic API.' });
    }

    // Strip markdown code fences if the model wrapped the JSON in ```json ... ```
    const cleaned = textBlock.text.replace(/^```json\s*|```$/g, '').trim();

    let result;
    try {
      result = JSON.parse(cleaned);
    } catch (e) {
      console.error('Failed to parse screening JSON:', cleaned);
      return res.status(502).json({ error: 'Could not parse AI screening response as JSON.' });
    }

    // Basic shape validation / defaults so the front-end never chokes on a
    // malformed response.
    result.score = Math.max(0, Math.min(100, parseInt(result.score, 10) || 0));
    if (!['Strong Fit', 'Possible Fit', 'Not a Fit'].includes(result.recommendation)) {
      result.recommendation = result.score >= 75 ? 'Strong Fit' : result.score >= 50 ? 'Possible Fit' : 'Not a Fit';
    }
    result.criteria = Array.isArray(result.criteria) ? result.criteria : [];
    result.strengths = Array.isArray(result.strengths) ? result.strengths : [];
    result.concerns = Array.isArray(result.concerns) ? result.concerns : [];
    result.steps = Array.isArray(result.steps) ? result.steps : [];

    res.json(result);
  } catch (err) {
    console.error('Screening route error:', err);
    res.status(500).json({ error: 'Internal server error during screening.' });
  }
});

function buildScreeningPrompt(applicant, position) {
  const posBlock = position
    ? `Position: ${position.title || 'N/A'}
Department: ${position.dept || 'N/A'}
Salary range: ${position.salary_min || 0} - ${position.salary_max || 0} PHP/month
Requirements / Qualifications: ${position.requirements || 'Not specified'}`
    : `Position: ${applicant.position_applied || 'N/A'} (no matching Job Position record found — screen generally based on stated position title)`;

  return `You are an HR screening assistant for a Philippine tax, accounting, audit, and business consulting firm. Screen the following job applicant against the position they applied for. Be fair, objective, and base your assessment only on the information given — do not invent facts.

${posBlock}

Applicant:
Name: ${applicant.full_name || 'N/A'}
Position applied: ${applicant.position_applied || 'N/A'}
Expected salary: ${applicant.expected_salary || 'N/A'} PHP/month
Most recent employer: ${applicant.company_name || 'N/A'}
Most recent position: ${applicant.recent_position || 'N/A'}
Current/last salary: ${applicant.current_salary || 'N/A'} PHP/month
Employment period: ${applicant.employment_start || 'N/A'} to ${applicant.employment_end || 'N/A'}
Years of experience: ${applicant.years_experience || 'N/A'}
Tools/software proficient: ${applicant.tools_proficient || 'N/A'}
Key strengths (self-described): ${applicant.key_strengths || 'N/A'}
Currently employed: ${applicant.is_currently_employed || 'N/A'}
Earliest start date if hired: ${applicant.earliest_start_date || 'N/A'}
Applying to other companies: ${applicant.other_applications || 'N/A'}

Score this applicant using these five criteria (each 0-100): Experience Match, Skills Match, Salary Fit, Availability, Job Stability. Then give an overall score (0-100, can be a weighted average or holistic judgment — your call, but be consistent), an overall recommendation, a one-paragraph summary, 2-4 strengths, and 2-4 concerns (if truly none, say so honestly rather than inventing one). Also produce a short "steps" list narrating your reasoning process (aim for around 5-8 steps, not necessarily exactly 13 — whatever number genuinely reflects distinct checks you performed, e.g. "Checked years of experience against requirement", "Compared expected salary to position range", etc.)

Respond with ONLY valid JSON in exactly this shape, no other text, no markdown fences:
{
  "score": <integer 0-100>,
  "recommendation": "Strong Fit" | "Possible Fit" | "Not a Fit",
  "summary": "<one paragraph>",
  "criteria": [
    {"name": "Experience Match", "score": <0-100>, "note": "<short note>"},
    {"name": "Skills Match", "score": <0-100>, "note": "<short note>"},
    {"name": "Salary Fit", "score": <0-100>, "note": "<short note>"},
    {"name": "Availability", "score": <0-100>, "note": "<short note>"},
    {"name": "Job Stability", "score": <0-100>, "note": "<short note>"}
  ],
  "strengths": ["<point>", "..."],
  "concerns": ["<point>", "..."],
  "steps": [{"step": "<short label>", "result": "<what you found>"}, "..."]
}`;
}

module.exports = router;
