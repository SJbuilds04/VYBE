# `--project <path>`: turn a codebase into a video

Read the project before directing. You are looking for the product's truth, not
for things to screenshot.

1. **What it is** — README, package description, landing page copy
   (`index.html`, `app/page.*`, `src/pages/index.*`), docs intro. Extract: name,
   one-line value proposition, 3 concrete capabilities, audience.
2. **How it looks** — brand tokens from CSS variables / Tailwind config /
   theme files (colors, font families, radius), the logo file (`public/`,
   `assets/`, `favicon.svg`). Override the VYBE tokens with these.
3. **What it does on screen** — key UI states worth showing. Rebuild them as
   simplified HTML/CSS mock UI inside the composition (crisp at any scale,
   animatable per element) rather than flat screenshots. If a live URL exists,
   `npx hyperframes capture <url>` gives real captures to work from.
4. **Proof** — numbers, stars, benchmarks, testimonials present in the repo. Use
   only real ones; never invent metrics.

Default template: `product-ad` (launch energy) — or `social-reel` when vertical.
Name the video after the product. Copy the logo into `composition/assets/images/`
and credit it as the project's own asset. Do not modify the user's project.
