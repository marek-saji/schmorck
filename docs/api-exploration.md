# Yorck API exploration

API is powered by Vista. Their API docs is available at:

- https://api.vista.co/WSVistaWebClient/api-docs/api-reference/v1
- https://api.vista.co/WSVistaWebClient/swagger/docs/5.0.15.26%20-%203295d4347650a17d899a90c01d0c16beb19fe2cd-V1

There’s also  client library for this API, thought it’s written in
elixir and not maintained:
https://github.com/gutschilla/elixir-vista-client

Yorck’s API URL and API key are hard–coded in the app. To obtain them:

1. Get the Yorck APK file, e.g. from your phone:
   ```sh
   adb pull $( adb shell pm path nz.co.vista.android.movie.yorckkinos | cut -d: -f2 ) yorck.apk
   ```
2. Read values from a config file:
   ```sh
   unzip -p yorck.apk res/raw/local_config.json \
     | jq '.Settings | {token: .local_connectSecurityToken, url: .vista_hostUrl}'
   ```

## API endpoints used by the app

> [!IMPORTANT]
> This project will use documented API endpoints, instead of the ones
> that the app uses. This is here for archival purposes.

<details>
<summary>How these were obtained?</summary>


1. Get Yorck app from your phone and patch it:
   ```
   adb pull $( adb shell pm path nz.co.vista.android.movie.yorckkinos | cut -d: -f2 ) yorck.apk
   npx apk-mitm yorck.apk
   # → creates yorck-patched.apk
   ```
2. Uninstall app on your phone
3. Install patched version of the app:
   ```
   adb install yorck-patched.apk
   ```
4. Start `mitmweb` and set it as a proxy on the phone.
5. Use the app and observe API calls.

</details>

### App launch data (incl. cinemas)

#### Request

```
GET https://connect.yorck.work//WSVistaWebClient/api/mobile/v1/app-launch-data HTTP/2.0
accept: application/json
connectapitoken: (secret)
content-type: application/json
accept-encoding: gzip
user-agent: okhttp/4.11.0
```

#### Response

```js
{
  siteGroups: [
    {
      name: "München",
      cinemaIds: ["…", …],
    },
    {
      name: "Berlin",
      cinemaIds: ["…", …],
    },
  ],
  cinemas: [
    {
      cinemaOperators: [
        {
          name: "…",
          shortName: "…",
        }
      ],
      id: "…",
      name: "…",
      address1: "…",
      address2: "…",
      latitude: 0,
      longitude: 0,
    },
```

### Movies

#### Request

```
GET https://connect.yorck.work//WSVistaWebClient/api/mobile/v1/films?salesChannel=CELL HTTP/2.0
accept: application/json
connectapitoken: (secret)
content-type: application/json
accept-encoding: gzip
user-agent: okhttp/4.11.0
```

#### Response

```
[
  {
    id: "…",
    title: "…",
    runTime: 0,
    openingDate: "0000-00-00T00:00:00",
    genreName: "…", // german
    customerRating: { count: 0, value: 0.0 },
    directors: ["…", …],
    actors: ["…", …],
    synopsis: "…", // german
    trailerUrl: "https://www.youtube.com/watch?v=…",
    cinemaAttributeLinks: [
      {
        cinemaId: "…",
        attributeShortNames: ["OmU", "…"],
      },
    ],
    cinemaIds: ["…", …],
  }
```

### Showtimes

#### Request

```
GET https://connect.yorck.work//WSVistaWebClient/api/mobile/v1/sessions?salesChannel=CELL&start=2026-03-21&end=2026-03-21&offset=0&includeStartedSessions=false HTTP/2.0
accept: application/json
connectapitoken: (secret)
content-type: application/json
accept-encoding: gzip
user-agent: okhttp/4.11.0
```

#### Response

```
[
    {
        sessionId: "…",
        cinemaId: "…",
        cinemaOperatorCode: "1001",
        filmId: "…",
        showtime: "0000-00-00T00:00:00",
        endTime: "0000-00-00T00:00:00",
        screenName: "…",
        screenNumber: 0,
        attributeShortNames: [
            "OmU",
             "…"
        ],
        trailerDuration: 0, // !
        seatsAvailable: 0,
        soldoutStatus: 0, // 0|1 probably
    },
```

### Movie poster

Doesn’t require `connectapitoken` header.

```
GET https://connect.yorck.work/CDN/media/entity/get/Movies/HO00004842 HTTP/2.0
```

No, API response for the film data doesn’t include info if poster is
there or not.
