# 0018. Demo content as a separate bundle, fail safe

Status: BUILT (loader, build script, manual workflow). No release is published and no setting is changed yet; the owner does that.
Date recorded: 2026-11-05
Owner approval: the direction (separate bundle on a GitHub Release, not baked into the image) is the owner's decision. The release and the Container App settings await the owner.

## Decision
1. Demo content (the media payload and the text payload) is NOT baked into the app image. It is one archive, the demo bundle, attached to a GitHub Release tagged `demo-bundle-<version>`.
2. The app is told only a URL, an expected version and an expected SHA-256 (configuration). It fetches the archive by plain HTTPS with no credentials, lazily on first demo use, and only while the demo switch (`CEVOC_DEMO_DATA_ENABLED`, record 0007 area, `docs/DEMO-DATA.md`) is on. With the switch off nothing is fetched.
3. Fail safe: any problem (unreachable, not 200, too large, checksum or version differs, a file without licence, author or credit, a file whose size or checksum differs, an unlisted or unsafe file) means demo content is unavailable. A demo number is then handed to the normal route like any other number, the hub says demo content is not available, one log line says why (the URL is not logged), and the app keeps running. Never a half-loaded set. The next demo use after a cool-down (default 10 minutes) tries again.
4. No bundle URL configured: the built-in sample content is used (generated SVG sample images, the sample video the front end ships). This is the least surprising: a fresh clone or an unconfigured deployment behaves exactly as before and needs no network.
5. Portability: the location is only a URL behind a small port, `DemoBundleSourcePort` (application layer, no vendor words). The one adapter, `HttpsDemoBundleSource` (`adapter.out.httpbundle`), is a plain HTTPS GET. Moving the bundle to any other web host or object store with a public or signed URL means changing the URL, not the code. Verification and unpacking are in the demo adapter and know nothing about the host.
6. Licence discipline is enforced twice: the build script (`scripts/build-demo-bundle.mjs`) refuses any file without a recorded source, author, licence, licence URL and a passed privacy check; the loader refuses a bundle in which any file lacks licence, author or credit.
7. Two payloads stay apart inside the archive: `media/` (images, video) and `text/` (banner lines per media file, credits). Banner text is text data, never pixels baked into a picture.

## Why a bundle on a Release
A Release asset is a plain HTTPS download, versioned by tag, immutable by convention, free for a public repository and independent of the app image, so demo media can change without a redeploy and the image stays small. Limits are recorded in `docs/DEMO-DATA.md` (unverified from the build sandbox).

## Consequences
- The first demo request after a restart waits for the download (timeout 60 seconds by default). Large video is not extracted until a case asks for it.
- The bundle is held in memory (tens of MB at most; the loader refuses more than 100 MB).
- Settings the owner may set later on the Container App: `CEVOC_DEMO_BUNDLE_URL`, `CEVOC_DEMO_BUNDLE_VERSION`, `CEVOC_DEMO_BUNDLE_SHA256` (see `docs/DEMO-DATA.md`). Setting none keeps the built-in content.
- The sample content now in the bundle is project-generated only. Real, openly licensed photographs and clips were not added (see `docs/DEMO-MEDIA.md`).

## Not done here
No release created, no workflow run, no Azure or repository setting changed.
