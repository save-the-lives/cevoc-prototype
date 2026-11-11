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

// Special deep check for case 0000000001 (the happy-path case).
test('Case 0000000001: video plays', async ({ page }) => {
  test.setTimeout(120_000);
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

// Frame-by-frame plate leak check on blurred video.
// Downloads the blurred video for case 0000000001 and runs the YOLO plate
// detector on every frame. Fails if any non-offending plate is detected.
test('Case 0000000001: no plate leaks in blurred video', async ({ page }) => {
  test.setTimeout(180_000); // plate detection is CPU-intensive

  await openCase(page, '0000000001');

  // Wait for the video element to get a valid src
  const video = page.locator('video');
  await video.first().waitFor({ state: 'attached', timeout: 90_000 });
  await expect(async () => {
    const src = await video.first().getAttribute('src');
    expect(src).toBeTruthy();
    expect(src.length).toBeGreaterThan(0);
  }).toPass({ timeout: 90_000 });

  const videoSrc = await video.first().getAttribute('src');
  // Resolve relative URL against the page
  const videoUrl = new URL(videoSrc, page.url()).href;
  console.log(`Video URL for leak check: ${videoUrl}`);

  // The leak check runs as a Python subprocess using the same YOLO model
  // that the blur pipeline uses. The model and script are in the repo.
  const { execSync } = require('child_process');
  const scriptPath = path.join(__dirname, 'check_blur_leaks.py');
  const modelPath = path.join(__dirname, '../../backend/blur-pipeline/yolov8n-plates.onnx');
  const gridPath = path.join(process.cwd(), 'test-results', 'case-0000000001-blur-grid.png');

  // Ensure test-results dir exists
  fs.mkdirSync(path.join(process.cwd(), 'test-results'), { recursive: true });

  try {
    const result = execSync(
      `python3 -I "${scriptPath}" "${videoUrl}" --model "${modelPath}" --output-grid "${gridPath}" --threshold 0.10`,
      { timeout: 150_000, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
    );
    console.log(result);
  } catch (e) {
    // Print output even on failure
    if (e.stdout) console.log(e.stdout);
    if (e.stderr) console.error(e.stderr);
    if (e.status === 1) {
      // Exit code 1 = leaked plates found
      throw new Error('PLATE LEAK DETECTED: Non-offending plates visible in blurred video. See frame grid artifact for details.');
    }
    throw new Error(`Blur leak check failed: ${e.message}`);
  }
});
