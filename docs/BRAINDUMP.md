There’s this chain of cinemas in Germany called Yorck.

They have a Next.js–based website which is _really_ bad. They also have
an app, which is better, but still not good and also I don’t like using
apps for things that can be done on a website.

Schedule can be accessed both via the website and the app.

Tickets as well, *but* in some cases tickets bought on one platform are
not visible on the other. Also when cancelling tickets, you can do it
only on the platform you bought it at.

I want to create a website of my own acting as an alternative UI to
Yorck’s ones that will be more reliable and provide some extra features.

Since their website is in Next.js using server actions, in theory we
could use it as API, but that might break every time they deploy, so
where possible, I want to figure out API they use for the app and use
that wherever it makes sense.

My rough plan is:

# v1.0.0 Schedule

- figure out API they use for the app (no auth)
- decide on frontend technology and display the schedule
- offline first, show stale while revalidating (with feedback)

# 1.1.0 Personalisation

- open question: Where do we store this?
  - possibly store in localStorage at first and later sync to places.
- make it possible to mark movies as (and show them in the schedule in
  this order):
  - new (bold UI for categorising)
  - watchlist
  - watched
  - not interested (collapsed)
- filter by langauges
  Parse “OmU”, “OemU” etc. User selects what languages they understand
  and we show screenings based on that.
- movie links
  - Yorck
  - Trakt
  - Letterboxd
- time links to Yorck


# 1.2.0

Use Trakt for watchlist and watched.

Organise in a way to make it easy to use others in the future, e.g.
Letterboxd.

# 2.0.0

Show bought tickets. More details where we get there. But we might want
to figure out using Next.js API as well and combine data from both
sources.
