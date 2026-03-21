# Yorck API

Yorck app uses Vista Connect.

This repo includes [swagger file with Vista Connect API](./vista-connect-5.0.15.26-3295d4347650a17d899a90c01d0c16beb19fe2cd-V1.swagger.json).

We will define `YORCK_VISTA_API_URL` and `YORCK_VISTA_API_KEY`
environment variables. See [Yorck API exploration](./api-exploration.md)
for how these values can be obtained.

All requests has to be made with headers:

```http
Content-Type: application/json
ConnectApiToken: (secret)
```
