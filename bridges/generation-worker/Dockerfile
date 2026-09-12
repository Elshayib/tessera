# Reference local generation worker wrapping TRELLIS.2 (`docs/07-providers.md` §8.3).
# Permissive license (Apache-2.0 / MIT components). Not built in CI.
FROM python:3.12-slim
WORKDIR /app
COPY server.py /app/server.py
EXPOSE 8090
ENV TRELLIS2_WEIGHTS=""
CMD ["python", "/app/server.py"]
