FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
COPY build/libs/*.jar /app/app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-Xms128m", "-Xmx192m", "-Xss256k", "-XX:+UseSerialGC", "-XX:+ExitOnOutOfMemoryError", "-jar", "/app/app.jar"]
