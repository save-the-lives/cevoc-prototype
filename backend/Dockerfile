# LIVE_BROWSER=false (default): the image as before, no browser. LIVE_BROWSER=true: owner-run live-check variant
# (-Plive-browser, Chromium + OS deps + Playwright browsers, Ubuntu 22.04 JRE). See docs/LIVE-CHECK.md.
ARG LIVE_BROWSER=false

FROM maven:3.9-eclipse-temurin-21 AS build
ARG LIVE_BROWSER
WORKDIR /src
COPY pom.xml .
RUN P=""; [ "$LIVE_BROWSER" = "true" ] && P="-Plive-browser"; mvn -B -q $P dependency:go-offline
COPY src ./src
RUN P=""; [ "$LIVE_BROWSER" = "true" ] && P="-Plive-browser"; mvn -B -q $P -DskipTests package
# Only used by the live variant: the Playwright CLI jars, to install the browsers into the runtime image.
RUN if [ "$LIVE_BROWSER" = "true" ]; then mvn -B -q -Plive-browser dependency:copy-dependencies -DincludeArtifactIds=playwright,driver,driver-bundle,gson -DoutputDirectory=/pw; else mkdir /pw; fi

FROM eclipse-temurin:21-jre AS runtime-false

FROM eclipse-temurin:21-jre-jammy AS runtime-true
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
    CEVOC_BROWSER_CONTAINER=true
COPY --from=build /pw /pw
RUN java -cp "/pw/*" com.microsoft.playwright.CLI install --with-deps chromium \
    && rm -rf /var/lib/apt/lists/* /pw \
    && useradd --system --no-create-home app && chmod -R a+rX /ms-playwright
# Set after the install above (it would skip the install). The app must never try to download browsers at run time.
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
USER app

FROM runtime-${LIVE_BROWSER}
WORKDIR /app
COPY --from=build /src/target/*.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
