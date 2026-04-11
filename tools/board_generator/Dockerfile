FROM python:3.12-slim AS generator-base

WORKDIR /app

COPY . .

FROM generator-base AS board-generator

ENTRYPOINT ["python", "generate_boards.py"]

FROM python:3.12-slim AS dictionary-export

WORKDIR /app

RUN apt-get update \
    && apt-get install --yes --no-install-recommends hunspell-el hunspell-en-us \
    && rm -rf /var/lib/apt/lists/*

COPY . .

ENTRYPOINT ["python", "export_dictionary.py"]
