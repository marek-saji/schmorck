## Now

- fetch watched data only for day in viewport
- api shield
  - pause between requests, but only a tiny bit, but keep track of how
    many requests has been made and increase the pause when closing to
    the limit
  - store info about fetching and restore at app start; if missing wait
    for some time
  - on the client look into sharing state between tabs
  - retrying on connection errors, with back off
  - check if online
  - use for for server and client, for Yorck and Trakt
    - for Trakt set rate limit / 2 (because we could be running both
      server and client from the same IP)

## Next

- recognise more types of rate limit headers (in case Yorck API uses them)
  https://chatgpt.com/c/69c4800c-bb88-8328-8026-c95d1889e915
- cache posters
- show <details> with raw film data; when mapping, include
  `Film._trakt` and `Film._yorck` for debugging
- When fetching, trakt data, also fetch `GET /movies/:id?extended=full`
  to get more info, incl. languages
- SOLVE PROBLEM with matching.
  - Sometimes `openingDate` is incorrect for re–release,
    e.g. “Mo’ Better Blues” is listed as 2026, but it’s actually a 1990 film.
  - Sometimes screenings should not be matched
    e.g. “Sneak Preview” is a special screening and should not be
    matched. But `openingDate` here is 2018 😖
  Trakt has `GET https://api.trakt.tv/movies/id/aliases`, which we can
  use to get titles in other languages.
  When looking for a match, if there’s no exact title+year match, hit up
  that endpoint to get German title and see if any of the search results
  is an exact match of German title + year. If that doesn’t match, then
  if the release is less than half a year different from current date,
  try the same, but without a year.
- enter Yorck ID manually and store in localStorage to add option to
  show it as QR code. Use https://dt.in.th/HDRQRCode trick
- watched / check–in buttons
- Yorck/Letterboxd/Trakt links on the list
- mark screenings if only few left (that will also show specials)
- mark if screening ends at wed/thu and there are no more
- style up de-emphasised film cards. Either–or:
  - shrink posters of de-emphasised film cards. Don’t break
    single–column layout. Animate with a bounce
  - set `max-height` to `calc(var(--font-size-lg) + 2 * var(--spacing-md))`.
    Remember to set title to non-sticky.
    Animate with a thump.
- order
  - instead of using CSS `order`, move things in DOM
  - Decouple `data-*` state from ordering, then we can revert `a438478`
  - try out: when changing status, update order with view transition
- marking non–trakt entries as watchlist (persist where?)
- show only cinemas in Berlin
- tests for trakt-client and possibly other things
- Use title and synopsis from trakt, but if it’s different than one
  from Yorck, display both (to spot false matches)
- When fetching stuff, stream response, so that user have something
  to look at
- Extract reusable components and keep style with them
- Display info about specials (e.g. marathons, previews, events).
  Check `CinemaEvents` endpoint or session attributes for special
  screening types. Some screenings only have a `yorck.de/de/specials/…`
  page (no `/films/…` equivalent) — detect these and link correctly.
- Check if SSE and banner are implemented properly
- Investigate performance issues. Possibly caused by SSE keeping
  connections open or blocking the event loop during cache refresh.
- Credits: Link to trakt
- use SSR components to reduce payload, since many things repeat
- sticky headers don’t work if date header is > 1 line high
- mark 70mm screenings
- prefetch in viewport links to /film
- other groupings (SSR):
  - date→film→time (default)
  - film→date→time
- Cache language detection in localStorage

## Later

- letterboxd

## Next features

- Figure out if we can sign in to Yorck to show our bookings, and if so,
  will these be ones from the app? If so, it’s useless.
- iCal feed (include trailer time)
