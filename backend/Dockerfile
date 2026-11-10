# One image, always with Chromium (-Plive-browser). The live check is switched on only by env settings at deploy time
# (CEVOC_LIVECHECK_ENABLED, CEVOC_PENALTY_LOOKUP_ADAPTER=browser and its URL and contact), see docs/LIVE-CHECK.md. Scrapers are off unless the browser adapter is selected.
# Layer order, most stable first, so an app-code change rebuilds only the build step and the last (thin) layer:
#   1. JDK/Maven base  2. pom.xml -> dependencies + Playwright CLI jars  3. JRE base, Tesseract (banner OCR), Chromium + OS deps  4. app jar
# Banner OCR (record 0019) calls the tesseract command line program from the app; English data only. It is always available;
# the scraping adapter uses it when active.

FROM maven:3.9-eclipse-temurin-21 AS deps
WORKDIR /src
COPY pom.xml .
RUN mvn -B -q -Plive-browser dependency:go-offline \
    && mvn -B -q -Plive-browser dependency:copy-dependencies -DincludeArtifactIds=playwright,driver,driver-bundle,gson -DoutputDirectory=/pw

FROM deps AS build
COPY src ./src
RUN mvn -B -q -Plive-browser -DskipTests package

# Browser layer: depends only on the Playwright jars (pom.xml), never on app code.
FROM eclipse-temurin:21-jre-jammy AS browser
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
    CEVOC_BROWSER_CONTAINER=true
COPY --from=deps /pw /pw
# Tesseract OCR (Apache-2.0), English data and no recommended extras: the one engine behind BannerTextReaderPort.
# curl: the `curl` certificates provider runs the curl command line program (record 0025); its TLS fingerprint is accepted where the JDK client is not.
# curl-impersonate: the `curl-impersonate` provider uses a pre-built static binary (Chrome variant, BoringSSL TLS fingerprint).
# Privacy blur (ADR 0017): Python + OpenCV + YuNet for server-side face/plate blurring.
# Tesseract: banner OCR (record 0019) + plate OCR for offending-plate match.
# curl/curl-impersonate: certificate fetch (record 0025).
RUN apt-get update && apt-get install -y --no-install-recommends \
    tesseract-ocr curl python3 python3-pip \
    libgl1-mesa-glx libglib2.0-0 \
    && pip3 install --no-cache-dir opencv-contrib-python-headless pytesseract numpy \
    && rm -rf /var/lib/apt/lists/* \
    && curl -fsSL -o /tmp/curl-impersonate.tar.gz \
       https://github.com/lwthiker/curl-impersonate/releases/download/v0.6.1/curl-impersonate-v0.6.1.x86_64-linux-gnu.tar.gz \
    && tar -xzf /tmp/curl-impersonate.tar.gz -C /usr/local/bin/ curl_chrome116 \
    && mv /usr/local/bin/curl_chrome116 /usr/local/bin/curl-impersonate \
    && chmod +x /usr/local/bin/curl-impersonate \
    && rm /tmp/curl-impersonate.tar.gz
RUN java -cp "/pw/*" com.microsoft.playwright.CLI install --with-deps chromium \
    && rm -rf /var/lib/apt/lists/* /pw \
    && useradd --system --no-create-home app && chmod -R a+rX /ms-playwright
# Set after the install above (it would skip the install). The app must never try to download browsers at run time.
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

# App layer: the thin one.
FROM browser
WORKDIR /app
COPY --from=build /src/target/*.jar app.jar
# Blur pipeline scripts + YuNet model (ADR 0017)
COPY blur-pipeline/ /app/blur-pipeline/
# Sample demo videos for server-side blur (ADR 0017); served through DemoRoutes, never raw.
# The CI workflow copies frontend/public/samples/*.mp4 here before the build.
COPY samples/ /app/samples/
USER app
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
