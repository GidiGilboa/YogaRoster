# WhatsApp Link Preview

How a published week's link turns into a rich preview card (image + title) instead of plain text/URL when shared.

## Flow

1. Teacher uploads a photo (JPEG, ≤300KB) and optionally a share message in Settings.
2. She publishes a week → the plan becomes public at `/plan/{teacherId}/{week}`.
3. She shares that link. WhatsApp's crawler requests the page and reads the server-rendered HTML directly — it does not run JavaScript, so all tags below must be present in the initial response.
4. It reads the Open Graph tags, builds a preview card, and caches it per-URL.

## OG tags served

| Tag | Source | Example |
|---|---|---|
| `og:title` | teacher's `shareMessage`, falls back to a generic title if unset | `בוקר טוב לכולם` |
| `og:description` | fixed, intentionally a single space | `" "` |
| `og:url` | the plan page's own absolute URL | `https://.../plan/{id}/{week}` |
| `og:image` | teacher's uploaded photo, served as-is (no resizing/compositing) | `https://.../uploads/share-{id}.jpg` |
| `og:image:type` | fixed | `image/jpeg` |

`og:image:width`/`height` are intentionally omitted — the photo isn't resized to a fixed canvas, so its real dimensions vary per teacher.

## Why `og:description` is blank

WhatsApp shows `og:title` as the bold headline and `og:description` as a line under it. Leaving a real description would duplicate the message already carried by `og:title`, so it's set to a single space rather than left unset (leaving it unset causes Next.js to silently fall back to the site's generic description instead of omitting the line).

## Image serving

The uploaded photo is served directly by a route handler (no image generation at request time) - this is what keeps the response fast and gives it a proper `Content-Length` header, both of which matter for WhatsApp's stricter image-rendering path (as opposed to its more lenient metadata-reading crawler).

## Crawler vs. real visitor

A real (unidentified) visitor is redirected to `/identify` to enter her name/phone. Crawlers never carry that cookie either, so without special handling they'd hit the same redirect and WhatsApp would scrape `/identify`'s generic metadata instead of the plan page's own. Known crawler user agents (WhatsApp, Facebook, Twitter, etc.) are detected and served the plan page directly, so the correct metadata is what gets scraped.

## Fallback (no uploaded photo)

Teachers who haven't uploaded a share photo get a generic branded placeholder image instead of a broken/missing preview.

## Caching

WhatsApp caches previews per exact URL, including query string. Changing a teacher's photo or message does not retroactively update links already shared - only newly shared (or explicitly cache-busted) links reflect the change.
