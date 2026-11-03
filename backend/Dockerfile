# One image, always with Chromium (-Plive-browser). The live check is switched on only by env settings at deploy time
# (CEVOC_LIVECHECK_ENABLED, CEVOC_SCRAPER_*), see docs/LIVE-CHECK.md. Scrapers are off unless those are set.
# Layer order, most stable first, so an app-code change rebuilds only the build step and the last (thin) layer:
#   1. JDK/Maven base  2. pom.xml -> dependencies + Playwright CLI jars  3. JRE base, Chromium + OS deps  4. app jar

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
