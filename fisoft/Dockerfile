# syntax=docker/dockerfile:1.7
# Stage 1: Cache dependencies and Build fat JAR
FROM gradle:8.12-jdk21 AS build
WORKDIR /app

# Copy gradle configuration files first to cache dependencies layer
COPY gradle /app/gradle
COPY gradlew gradlew.bat build.gradle.kts settings.gradle.kts gradle.properties /app/

# Download dependencies with BuildKit cache mount
RUN --mount=type=cache,target=/root/.gradle ./gradlew dependencies --no-daemon

# Copy source files
COPY src /app/src

# Build fat JAR using Gradle cache
RUN --mount=type=cache,target=/root/.gradle ./gradlew buildFatJar --no-daemon

# Stage 2: Minimal Runtime stage
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
COPY --from=build /app/build/libs/*.jar /app/app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
