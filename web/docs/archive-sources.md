# Living newsletter archive: source and scope

The archive presents all 102 pages of four public newsletters published by Terrace F. Club, with a hand-curated topic layer for selected stories. Every page can be read on the site in its original proportions, alongside automatically extracted text. This is not a CMS import or a manually corrected transcription. The linked original PDF remains the source of record.

| Issue | Pages | Original PDF | SHA-256 of downloaded PDF |
| --- | ---: | --- | --- |
| Spring 2026 | 14 | [Spring 2026](https://princetonterraceclub.org/wp-content/uploads/Spring-Newsletter-2026-6.pdf) | `982c143c45f74de570d29e7c8a89ebf343d30484cc3f1c70c248cc155ed6e6ad` |
| Fall 2025 | 36 | [Fall 2025](https://princetonterraceclub.org/wp-content/uploads/2025_Fall_Newsletter_FINAL_2.pdf) | `06ebbe808cd53fdd032e353033ceb90df733a76e9c3357ee535ae7c654a65ce8` |
| Summer 2024 | 19 | [Summer 2024](https://princetonterraceclub.org/wp-content/uploads/2024-TFC-Summer-Newsletter-3.pdf) | `1a22f183c097b394d9d668b8b53195f0694850d25f691a5dfc68d0f8bdb793a5` |
| Fall 2023 | 33 | [Fall 2023](https://princetonterraceclub.org/wp-content/uploads/2023-Newsletter-2.pdf) | `871d1dab35cca5c9062cb2cb6d2da04c85d2c59a5256a736330c28b1ed13cf54` |

Source PDFs were downloaded and checked on 2026-10-28. Each local WebP is a resized rendering of its cited PDF page, with no added design or altered content. [The asset manifest](../static/archive/manifest.json) records page, source URL, PDF checksum, local image checksum, dimensions, and alt text. The archive intentionally does not ship the large PDF files; visitors can read the responsive page images locally or follow the original public PDF URLs. The [full-reader manifest](../static/archive/pages/manifest.json) records every full-size and small derivative; `src/lib/archive/pages.json` adds the extracted text. `src/lib/archive/ocr/` holds a separate OCR reading of each page image, produced by the rerunnable job in `tools/newsletter-ocr/`; it records the image hash, confidence and tool version, and is uncorrected machine output. The reader's search shows only snippets taken from those two text sources.

The selected topics include recipes (2023 pp. 28–29; 2024 p. 17; 2025 pp. 32–34), Solarium Sessions (2023 pp. 11 and 19), a Reunions rave poster (2023 p. 15), a green room ceiling painting (2023 p. 17), a pool match photograph (2023 p. 9), and the 2026 undergrad officer introductions (2026 pp. 3–4). The Fall 2023 “Officer elections 2045” pages are a playful future ballot and must not be treated as current officer information.

The curated archive is present when the CMS has no published newsletter records. The “More from the publisher” block uses the existing published-only content adapter; a CMS outage still returns a 503 for the whole newsletter index, consistent with other content pages. Curated issue guide URLs remain independently available. No draft issue is exposed by this archive. Future editors can add curated items after checking page text and image rights, or publish issues through the CMS for the separate publisher block.
