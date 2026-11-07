# One image, always with Chromium (-Plive-browser). The live check is switched on only by env settings at deploy time
# (CEVOC_LIVECHECK_ENABLED, CEVOC_PENALTY_LOOKUP_ADAPTER=browser and its URL and contact), see docs/LIVE-CHECK.md. Scrapers are off unless the browser adapter is selected.
# Layer order, most stable first, so an app-code change rebuilds only the build step and the last (thin) layer:
#   1. JDK/Maven base  2. pom.xml -> dependencies + Playwright CLI jars  3. JRE base, Tesseract (banner OCR), Chromium + OS deps  4. app jar
# Banner OCR (record 0019) calls the tesseract command line program from the app; English data only. It is used only when
# CEVOC_BANNER_OCR_ENABLED=true.

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
RUN apt-get update && apt-get install -y --no-install-recommends tesseract-ocr curl \
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
USER app
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
