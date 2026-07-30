# Stage 1: Build fat JAR
FROM gradle:8.12-jdk21 AS build
WORKDIR /app

COPY gradle /app/gradle
COPY gradlew gradlew.bat build.gradle.kts settings.gradle.kts gradle.properties /app/
COPY src /app/src

RUN ./gradlew buildFatJar --no-daemon

# Stage 2: Minimal Runtime stage
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
COPY --from=build /app/build/libs/*.jar /app/app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
