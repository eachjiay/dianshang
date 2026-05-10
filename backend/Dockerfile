# Build stage
FROM maven:3.9-eclipse-temurin-21 AS builder
WORKDIR /app
COPY pom.xml ./
RUN mvn -B -ntp dependency:go-offline
COPY . .
RUN mvn -B -ntp package -DskipTests

# Production stage
FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=builder /app/target/diquan-backend-1.0.0.jar ./app.jar
# SQLite DB persistence
VOLUME /app/data
ENV PORT=5000
ENV DB_PATH=/app/data/database.sqlite
EXPOSE 5000
CMD ["java", "-jar", "app.jar"]
