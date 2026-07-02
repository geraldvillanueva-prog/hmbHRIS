/**
 * ============================================================================
 * Insert an Indeed applicant into Supabase (hmb_applicants table)
 * ============================================================================
 * Paste this into HMB_Gmail_Screening.gs. Call insertApplicantToSupabase(...)
 * right after you've parsed an Indeed notification email (and, if you want,
 * after your existing screening step has produced a score/summary) — see the
 * usage example at the bottom of this file.
 *
 * SETUP:
 * 1. In the Apps Script editor: Project Settings (gear icon) → Script
 *    Properties → add two properties:
 *      SUPABASE_URL  = https://xxxxxxxxxxxx.supabase.co   (same one used in
 *                       admin.html's Webhook/QR tab and the public form)
 *      SUPABASE_ANON_KEY = eyJhbGciOi...                   (same anon key)
 *    Storing them as Script Properties keeps the key out of the source code.
 * 2. Make sure the fields you extract from the Indeed email map to the
 *    fields below as closely as possible. Indeed emails don't give you
 *    everything the QR form does (e.g. no "expected salary" field usually) —
 *    that's fine, just pass null/blank for whatever Indeed doesn't provide.
 * ============================================================================
 */

function insertApplicantToSupabase(applicantData) {
  var props = PropertiesService.getScriptProperties();
  var SUPABASE_URL = props.getProperty('SUPABASE_URL');
  var SUPABASE_ANON_KEY = props.getProperty('SUPABASE_ANON_KEY');

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('SUPABASE_URL / SUPABASE_ANON_KEY not set in Script Properties. See setup notes at the top of this file.');
  }

  // Same schema as the QR application form (index.html) and admin.html.
  // Anything Indeed doesn't give you should just be left null — admin.html
  // already handles blank fields gracefully.
  var rec = {
    applicant_code: 'IND-' + Utilities.getUuid().slice(0, 8).toUpperCase(),
    full_name: applicantData.full_name || '',
    address: applicantData.address || null,
    mobile_number: applicantData.mobile_number || null,
    email_address: applicantData.email_address || '',
    position_applied: applicantData.position_applied || '',
    expected_salary: applicantData.expected_salary || 0,
    company_name: applicantData.company_name || null,
    recent_position: applicantData.recent_position || null,
    current_salary: applicantData.current_salary || 0,
    employment_start: applicantData.employment_start || null,
    employment_end: applicantData.employment_end || null,
    years_experience: applicantData.years_experience || null,
    tools_proficient: applicantData.tools_proficient || null,
    key_strengths: applicantData.key_strengths || null,
    is_currently_employed: applicantData.is_currently_employed || null,
    earliest_start_date: applicantData.earliest_start_date || null,
    other_applications: applicantData.other_applications || null,
    resume_url: applicantData.resume_url || null,
    status: 'New Applicant',
    source: 'Indeed' // admin.html can use this to show an "Indeed" badge
  };

  var options = {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
      'Prefer': 'return=representation'
    },
    payload: JSON.stringify(rec),
    muteHttpExceptions: true
  };

  var url = SUPABASE_URL.replace(/\/$/, '') + '/rest/v1/hmb_applicants';
  var response = UrlFetchApp.fetch(url, options);
  var code = response.getResponseCode();

  if (code === 201 || code === 200) {
    Logger.log('Inserted Indeed applicant into Supabase: ' + rec.full_name);
    return JSON.parse(response.getContentText())[0];
  } else {
    // Common cause: this applicant's email already exists and you have a
    // unique constraint on email_address — decide whether to skip or update
    // in that case rather than erroring every run.
    Logger.log('Supabase insert failed (' + code + '): ' + response.getContentText());
    throw new Error('Supabase insert failed with status ' + code + ': ' + response.getContentText());
  }
}

/**
 * ── EXAMPLE USAGE ──
 * Wherever your existing script currently finishes processing one Indeed
 * applicant (after parsing the email, and optionally after your own
 * screening step), add a call like this:
 *
 *   insertApplicantToSupabase({
 *     full_name: parsedName,
 *     email_address: parsedEmail,
 *     position_applied: parsedPosition,
 *     resume_url: parsedResumeLink,
 *     years_experience: parsedYearsExp
 *     // ...whatever else you're able to extract
 *   });
 *
 * Wrap it in try/catch so a Supabase hiccup doesn't stop the rest of your
 * script (e.g. still logging to your Google Sheet either way):
 *
 *   try {
 *     insertApplicantToSupabase({ ... });
 *   } catch (e) {
 *     Logger.log('Could not sync to admin panel: ' + e.message);
 *   }
 */
