# TODO

- [ ] Switch from `OData.svc/ScheduledFilms` to `/mobile/v1/films` endpoint.
      The mobile endpoint returns more data (e.g. `genreName`, `directors`,
      `customerRating`). Implement the mapper so it accepts both response
      shapes (OData and mobile).
- [ ] Display film info in English. The mobile endpoint provides `TitleAlt`
      and `SynopsisAlt` fields which contain English translations.
- [ ] Display info about specials (e.g. marathons, previews, events).
      Check `CinemaEvents` endpoint or session attributes for special
      screening types.
- [ ] Look up films on Trakt and Letterboxd. Store lookups somewhere
      (file-based cache or SQLite) to avoid repeated requests.
