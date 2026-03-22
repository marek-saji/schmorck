# TODO

- [ ] Credits: Combine Director and Writer, if same
- [ ] Credits: Show Director and Writer on /film/:slug
- [ ] z-index on sticky elements only when they are stuck (for browsers that support it)
- [ ] Display info about specials (e.g. marathons, previews, events).
      Check `CinemaEvents` endpoint or session attributes for special
      screening types. Some screenings only have a `yorck.de/de/specials/…`
      page (no `/films/…` equivalent) — detect these and link correctly.
- [ ] Investigate performance issues. Possibly caused by SSE keeping
      connections open or blocking the event loop during cache refresh.
- [ ] scroll snap to date headings and film cards?
- [ ] Credits: Link to trakt
