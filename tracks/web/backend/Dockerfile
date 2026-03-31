FROM rust:1.88-bookworm AS builder

WORKDIR /app

COPY Cargo.toml Cargo.lock ./
COPY shared ./shared
COPY backend ./backend

RUN cargo build -p whiteboard-backend --release

FROM debian:bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=builder /app/target/release/whiteboard-backend /usr/local/bin/whiteboard-backend

RUN mkdir -p /app/data/rooms /app/data/emergency /app/data/logs

ENV APP_HOST=0.0.0.0
ENV APP_PORT=3000

EXPOSE 3000

CMD ["whiteboard-backend"]
