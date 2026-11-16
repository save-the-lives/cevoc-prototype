# Lean backend image — Java API only, no Chromium, no heavy ML deps.
# Chromium (browser worker) and Python/OpenCV (blur worker) live in their own containers.
# Use this for deployments where the browser and blur pipelines run as sidecars or separate services.
#
# Layer order: 1. JDK/Maven base  2. pom.xml → dependencies  3. JRE base + minimal Python  4. app jar
#
# Build:  docker build -f Dockerfile.lean -t cevoc-api .

# --- Dependencies (no -Plive-browser: Playwright jars not needed) ---
FROM maven:3.9-eclipse-temurin-21 AS deps
WORKDIR /src
COPY pom.xml .
RUN mvn -B -q dependency:go-offline

FROM deps AS build
COPY src ./src
RUN mvn -B -q -DskipTests package

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

# Sample demo videos (served through DemoRoutes when CEVOC_DEMO_DATA_ENABLED=true)
COPY samples/ /app/samples/

USER app
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
