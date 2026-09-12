# generation-worker

Reference Dockerfile wrapping TRELLIS.2 behind the Tessera local worker HTTP contract (`docs/07-providers.md` §8.3):

- `POST /v1/jobs`
- `GET /v1/jobs/{id}`
- `GET /v1/jobs/{id}/result`
- `DELETE /v1/jobs/{id}`
- `GET /v1/capabilities`

Optional bearer token. Not built in CI. Point `@tessera/providers-generation` `createLocalWorkerProvider` at `http://127.0.0.1:8090`.
