# Lean backend image — Java API only, no Chromium, no heavy ML deps.
# Chromium (browser worker) and Python/OpenCV (blur worker) live in their own containers.
#
# Layer order: 1. JDK/Maven base  2. pom.xml → dependencies  3. JRE + Python  4. app jar
#
# Build:  docker build -f Dockerfile.lean -t cevoc-api .

# --- Dependencies (build with -Plive-browser for compile, but no Chromium at runtime) ---
FROM maven:3.9-eclipse-temurin-21 AS deps
WORKDIR /src
COPY pom.xml .
RUN mvn -B -q -Plive-browser dependency:go-offline \
    && mvn -B -q -Plive-browser dependency:copy-dependencies -DincludeArtifactIds=playwright,driver,driver-bundle,gson -DoutputDirectory=/pw

FROM deps AS build
COPY src ./src
RUN mvn -B -q -Plive-browser -Dmaven.test.skip=true package

# --- Runtime: JRE + Python/OpenCV for blur (no Chromium, no Tesseract) ---
# The blur pipeline runs as a subprocess (ProcessBlurAdapter) and needs Python + OpenCV.
# Once QueueBlurAdapter is the default and the blur worker container handles all blur work,
# strip Python entirely and this becomes a ~250 MB pure-JVM image.
FROM eclipse-temurin:21-jre-jammy

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-pip libgl1-mesa-glx libglib2.0-0 ffmpeg \
    && pip3 install --no-cache-dir opencv-contrib-python-headless numpy \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --system --no-create-home app

WORKDIR /app
COPY --from=build /src/target/*.jar app.jar

# Blur pipeline scripts + YuNet model (ADR 0017)
COPY blur-pipeline/ /app/blur-pipeline/

# Sample demo videos — optional, may not exist in backend/ context.
# CI should copy frontend/public/samples/*.mp4 here before building.
RUN mkdir -p /app/samples
COPY sample[s]/ /app/samples/
# The built site (record 0031): the deploy workflows copy frontend/dist here; empty in a local build.
COPY site/ /app/site/
# The commit this image was built from, answered by /api/version (the deploy waits for it).
ARG BUILD_SHA=unknown
ENV CEVOC_BUILD_SHA=$BUILD_SHA

USER app
EXPOSE 8080

# JVM tuning: container-aware memory settings, faster startup
ENTRYPOINT ["java", \
  "-XX:+UseContainerSupport", \
  "-XX:MaxRAMPercentage=75.0", \
  "-XX:+UseG1GC", \
  "-Djava.security.egd=file:/dev/./urandom", \
  "-jar", "/app/app.jar"]
