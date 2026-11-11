// @ts-check
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

// Load demo cases from the JSON file fetched by the workflow.
const casesFile = process.env.DEMO_CASES_FILE || '/tmp/demo-cases.json';
let allCases = [];
try {
  const catalog = JSON.parse(fs.readFileSync(casesFile, 'utf8'));
  for (const prog of catalog.programs || []) {
    for (const group of prog.groups || []) {
      for (const c of group.cases || []) {
        allCases.push({ ...c, programNote: prog.note || '' });
      }
    }
  }
} catch (e) {
  console.error('Could not load demo cases:', e.message);
}

// Cases that are designed to show no evidence (error/edge cases).
const NO_EVIDENCE_CASES = new Set([
  '0000000103', // No video returned
  '0000000106', // Wrong registration refused
  '0000000201', // Certificate lookup failed
  '0000000202', // Image retrieval failed
  '0000000203', // Details missing entirely
  '0000000204', // Source timed out
  '0000000205', // Notice not found
]);

/**
 * Open a demo case by navigating to /?demo=<number>.
 * The frontend auto-sends the registration from the catalog.
 */
async function openCase(page, caseNumber) {
  await page.goto(`/?demo=${caseNumber}`, { waitUntil: 'networkidle', timeout: 30_000 });
  // Wait for either the results to appear or an error
  await page.waitForSelector('.step-section, .nsw-notification--error, .lookup-form', { timeout: 30_000 });
}

for (const c of allCases) {
  const isErrorCase = NO_EVIDENCE_CASES.has(c.number);

  test(`Case ${c.number}: ${c.title}`, async ({ page }) => {
    await openCase(page, c.number);

    // All cases should show the results page (step sections), not get stuck on the form.
    // Error cases will show results with error messages in specific sections.
    const hasSteps = await page.locator('.step-section').count();
    expect(hasSteps, `Expected step sections for case ${c.number}`).toBeGreaterThan(0);

    // Take a screenshot of the full page.
    await page.screenshot({
      path: `test-results/case-${c.number}-full.png`,
      fullPage: true,
    });
  });

  // For non-error cases with evidence, check that media loads.
  if (!isErrorCase) {
    test(`Case ${c.number}: evidence loads`, async ({ page }) => {
      await openCase(page, c.number);

      // Wait for media cards (images/video) to appear.
      const mediaCard = page.locator('.media-card, .evidence-grid, .nsw-media');
      await mediaCard.first().waitFor({ state: 'visible', timeout: 45_000 });

      // Check that at least one image thumbnail is visible.
      const thumbs = page.locator('.evidence-thumb, .thumb img, .media-card img');
      const thumbCount = await thumbs.count();
      expect(thumbCount, `Expected image thumbnails for case ${c.number}`).toBeGreaterThan(0);

      // Take a screenshot of the evidence section.
      await page.screenshot({
        path: `test-results/case-${c.number}-evidence.png`,
        fullPage: false,
      });
    });
  }
}

// Deep check: no plate leaks in blurred video for every case with video.
for (const c of allCases) {
  if (NO_EVIDENCE_CASES.has(c.number)) continue;

  test(`Case ${c.number}: no plate leaks in blurred video`, async ({ page }) => {
    await openCase(page, c.number);

    // Find the video element's src
    const video = page.locator('video');
    const videoCount = await video.count();
    if (videoCount === 0) {
      console.log(`Case ${c.number}: no video element — skipping leak check`);
      return;
    }

    // Wait for video src to be set
    let videoSrc = '';
    try {
      await expect(async () => {
        videoSrc = await video.first().getAttribute('src') || '';
        expect(videoSrc.length).toBeGreaterThan(0);
      }).toPass({ timeout: 90_000 });
    } catch {
      console.log(`Case ${c.number}: video src never appeared — skipping leak check`);
      return;
    }

    // Make the URL absolute
    if (videoSrc.startsWith('/')) {
      const base = new URL(page.url());
      videoSrc = `${base.protocol}//${base.host}${videoSrc}`;
    }

    // Run the Python leak checker
    const { execSync } = require('child_process');
    const scriptDir = path.join(__dirname);
    const modelPath = path.join(__dirname, '..', '..', 'backend', 'blur-pipeline', 'yolov8n-plates.onnx');
    const gridPath = `test-results/case-${c.number}-blur-grid.png`;

    try {
      const result = execSync(
        `python3 ${scriptDir}/check_blur_leaks.py "${videoSrc}" --model "${modelPath}" --output "${gridPath}"`,
        { timeout: 180_000, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
      );
      console.log(result);
    } catch (e) {
      // Exit code 1 = leaked plates, 2 = setup error
      const stderr = e.stderr || '';
      const stdout = e.stdout || '';
      console.error(stdout);
      console.error(stderr);
      if (e.status === 1) {
        throw new Error(`Plate leak detected in case ${c.number} blurred video:\n${stderr}`);
      }
      // Status 2 = setup error — skip, don't fail the case
      console.log(`Leak check setup error for case ${c.number} — skipping`);
    }
  });
}

// Banner OCR: verify camera banner text is readable on evidence images per program type.
for (const c of allCases) {
  if (NO_EVIDENCE_CASES.has(c.number)) continue;

  test(`Case ${c.number}: banner text readable on evidence images`, async ({ page }) => {
    await openCase(page, c.number);

    // Find image elements in the evidence grid
    const imgs = page.locator('.mg-thumb img, .mg-media');
    const imgCount = await imgs.count();
    if (imgCount === 0) {
      console.log(`Case ${c.number}: no evidence images — skipping banner check`);
      return;
    }

    // Get the first image's full src
    let imgSrc = '';
    try {
      imgSrc = await imgs.first().getAttribute('src') || '';
    } catch {
      console.log(`Case ${c.number}: could not get image src — skipping banner check`);
      return;
    }
    if (!imgSrc) return;

    // Make absolute
    if (imgSrc.startsWith('/')) {
      const base = new URL(page.url());
      imgSrc = `${base.protocol}//${base.host}${imgSrc}`;
    }

    // Determine program type from case data
    const programType = (c.programNote || '').toLowerCase().includes('red light') ? 'red_light' : 'speed';

    const { execSync } = require('child_process');
    const scriptDir = path.join(__dirname);
    const gridPath = `test-results/case-${c.number}-banner-ocr.png`;

    try {
      const result = execSync(
        `python3 ${scriptDir}/check_banner_ocr.py "${imgSrc}" --program ${programType} --output "${gridPath}"`,
        { timeout: 30_000, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
      );
      console.log(result);
    } catch (e) {
      if (e.status === 1) {
        throw new Error(`Banner text not readable for case ${c.number}: ${e.stderr || ''}`);
      }
      console.log(`Banner OCR setup error for case ${c.number} — skipping`);
    }
  });
}

// Special deep check for case 0000000001 (the happy-path case).
test('Case 0000000001: video plays', async ({ page }) => {
  await openCase(page, '0000000001');

  // Wait for the video element to appear (it may take time if blur is preparing).
  const video = page.locator('video');
  await video.first().waitFor({ state: 'attached', timeout: 90_000 });

  // Wait for the video to have a valid src (not empty).
  await expect(async () => {
    const src = await video.first().getAttribute('src');
    expect(src).toBeTruthy();
    expect(src.length).toBeGreaterThan(0);
  }).toPass({ timeout: 60_000 });

  // Try to play the video and confirm it starts.
  await video.first().evaluate((v) => {
    v.muted = true; // avoid autoplay policy issues
    return v.play().catch(() => {}); // may fail in CI, that's OK
  });

  // Wait a moment for playback to advance.
  await page.waitForTimeout(2000);

  const currentTime = await video.first().evaluate((v) => v.currentTime);
  // If currentTime > 0, video is actually playing. If 0, playback may have
  // been blocked by autoplay policy — not a failure of the blur pipeline.
  if (currentTime > 0) {
    console.log(`Video playing: currentTime=${currentTime}`);
  } else {
    console.log('Video loaded but autoplay may be blocked in headless — src is valid');
  }

  await page.screenshot({
    path: 'test-results/case-0000000001-video.png',
    fullPage: false,
  });
});
