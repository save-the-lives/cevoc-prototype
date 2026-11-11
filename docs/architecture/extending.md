# Extending the system

Step-by-step guides for common extension tasks. Every change follows the same principle: the domain and application layers should never change for infrastructure work; new capabilities are added as new adapters behind existing ports or as new ports with their own adapters.

## Adding a new camera program

Example: adding a "Mobile phone detection camera" program.

### Backend

1. No backend changes needed if the program's data comes through the same `PenaltyLookupPort`. The flexible details map (`Map<String, Object>`) carries any program-specific fields.

2. If the program needs its own demo cases, add them in `DemoScenarios.java`:
   ```java
   out.add(s(p, 1).title("Phone use detected", "...").images(2));
   ```
   And add program-specific detail fields in `DemoCaseFactory.detailsMap()`:
   ```java
   m.put("deviceType", "Mobile phone");
   m.put("detectionConfidence", "High");
   ```

### Frontend

1. Add the program in `programs.json`:
   ```json
   {
     "id": "MOBILE_PHONE",
     "label": "Mobile phone detection camera",
     "match": {"offenceTextContains": ["mobile phone", "use phone"], "detailKeysAny": ["deviceType"]},
     "versions": [{ "version": "2026-a", "from": "2000-01-01", "details": [...], "types": {...} }]
   }
   ```

2. Optionally add a visual component (`MobilePhoneVisual.jsx`) and wire it in `ProgramDetails.jsx`:
   ```jsx
   if (program.id === 'MOBILE_PHONE') {
     return <MobilePhoneVisual rows={view.rows} details={result?.details} />;
   }
   ```

3. The generic `GenericGrid` in `ProgramDetails.jsx` handles programs without a custom visual.

## Adding a new evidence type

Example: adding audio recordings as evidence.

1. Add a new `Kind` to `EvidenceItem`:
   ```java
   public enum Kind { IMAGE, VIDEO, CERTIFICATE, AUDIO }
   ```

2. The `MediaController` already serves any media by hash — no changes needed for serving.

3. In the frontend, add an `EvidenceAudio.jsx` component and render it in `EvidenceGrid.jsx` alongside images and video.

4. Add the type switch in `programs.json` under `types`:
   ```json
   "audio": { "mode": "on", "messageNone": "No audio recording for this notice." }
   ```

## Adding a new lookup source (data provider)

Example: replacing Revenue NSW with a TfNSW API.

1. Create the adapter: `adapter/out/tfnsw/TfnswLookupAdapter.java`
   ```java
   @Component
   @ConditionalOnProperty(name = "cevoc.penalty-lookup.adapter", havingValue = "api")
   public class TfnswLookupAdapter implements PenaltyLookupPort { ... }
   ```

2. Add ArchUnit isolation rules in `ArchitectureTest.java`.

3. Add config documentation in `docs/CONFIG-REFERENCE.md`.

4. Select with: `CEVOC_PENALTY_LOOKUP_ADAPTER=api`

5. The frontend does not change — it receives the same `PenaltyLookupResult` shape.

## Changing the blur pipeline

### Adding a new detection model

1. Add the model file to `backend/blur-pipeline/`
2. Create a detection script (e.g. `detect_text.py`) outputting JSON regions:
   ```json
   {"regions": [{"label": "TEXT", "frames": [{"frame": 0, "x": 10, "y": 20, "w": 100, "h": 30, "confidence": 0.9}]}]}
   ```
3. Add the script call in `ProcessBlurAdapter.blurSync()`:
   ```java
   runScript("detect_text.py", inputPath, regionsPath, "--model", modelPath);
   ```
4. `render_blur.py` already handles any region format — no changes needed.

### Adjusting detection thresholds

All thresholds are at the top of each detection script as constants:
- `detect_plates.py`: `CONF_THRESHOLD = 0.15`, padding `PAD = 0.20`
- `detect_faces.py`: `SCORE_THRESHOLD = 0.9`, `NMS_THRESHOLD = 0.3`
- `render_blur.py` verification: `VERIFY_CONF = 0.20`

Lower thresholds = more detections (higher recall, more false positives).

## Adding cloud-specific infrastructure

Each cloud provider has its own adapter package and IaC templates:

| Cloud | Adapter package | IaC |
|---|---|---|
| Azure | `adapter.out.azureblob` | `infra/azure/` (Bicep) |
| AWS | `adapter.out.s3` | `infra/aws/` (CloudFormation) |

To add a new cloud (e.g. GCP):
1. Create `adapter/out/gcs/GcsMediaAdapter.java` implementing `MediaStoragePort`
2. Add ArchUnit isolation rule
3. Create `infra/gcp/` with Terraform or Deployment Manager templates
4. Add `gcs` as a value for `cevoc.media.adapter`
