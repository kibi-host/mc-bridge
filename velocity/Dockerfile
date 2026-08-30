FROM gradle:jdk25-ubi10 AS builder

WORKDIR /app
COPY settings.gradle build.gradle ./
COPY config ./config
COPY src ./src
RUN gradle --no-daemon clean build

FROM itzg/mc-proxy:java25
ADD https://github.com/Elytrium/LimboAPI/releases/download/1.1.26/limboapi-1.1.26.jar /plugins/limboapi.jar

COPY --from=builder /app/build/libs/queue-velocity-*.jar /plugins/queue-velocity.jar
COPY --from=builder /app/config/queue-velocity.properties /config/plugins/queue-velocity.properties
COPY --from=builder /app/config/velocity.toml /config/velocity.toml