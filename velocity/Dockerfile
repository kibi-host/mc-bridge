FROM gradle:8.14-jdk25 AS builder

WORKDIR /build
COPY settings.gradle build.gradle ./
COPY src ./src
RUN gradle --no-daemon clean build

FROM itzg/mc-proxy:java25
# LimboAPI is a Velocity plugin, so it must be present at runtime as well as
# compile-only on the queue plugin's classpath.
ADD https://github.com/Elytrium/LimboAPI/releases/download/1.1.26/limboapi-1.1.26.jar /plugins/limboapi.jar
COPY --from=builder /build/build/libs/queue-velocity-*.jar /plugins/queue-velocity.jar
