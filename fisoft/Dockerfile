FROM eclipse-temurin:21-jre-alpine

WORKDIR /app

COPY build/libs/*.jar app.jar

EXPOSE 8080

ENTRYPOINT ["java","-Xms512m","-Xmx2048m","-XX:+UseG1GC","-XX:+AlwaysActAsServerClassMachine","-XX:+ExitOnOutOfMemoryError","-jar","app.jar"]