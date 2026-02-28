# Semantic HTML Tag Reference

A quick-reference guide for choosing the correct semantic HTML element.

## Landmark Elements

| Element | Use When |
|---|---|
| `<header>` | Introductory content for the page or a section (logo, nav, hero) |
| `<nav>` | Primary navigation blocks (main menu, breadcrumbs, pagination) |
| `<main>` | The dominant content of the `<body>` — only one per page |
| `<article>` | Self-contained, independently distributable content (blog post, news story, comment) |
| `<section>` | Thematic grouping of content, typically with a heading |
| `<aside>` | Content tangentially related to the main content (sidebar, callout, related links) |
| `<footer>` | Footer for the page or a section (copyright, contact, sitemap links) |

## Content Elements

| Element | Use When |
|---|---|
| `<figure>` + `<figcaption>` | Images, diagrams, or code snippets with a caption |
| `<time datetime="...">` | Dates, times, or durations (machine-readable for search engines) |
| `<address>` | Contact information for the author or organization |
| `<mark>` | Highlighted or referenced text |
| `<details>` + `<summary>` | Expandable/collapsible content (FAQs, accordions) |

## Common Anti-Patterns

| ❌ Don't | ✅ Do Instead |
|---|---|
| `<div class="nav">` | `<nav>` |
| `<div class="footer">` | `<footer>` |
| `<div class="article">` | `<article>` |
| `<span class="date">Jan 15</span>` | `<time datetime="2025-01-15">Jan 15</time>` |
| `<b>` for emphasis | `<strong>` for semantic emphasis |
| `<i>` for emphasis | `<em>` for semantic emphasis |

## Resources
- [MDN: HTML elements reference](https://developer.mozilla.org/en-US/docs/Web/HTML/Element)
- [W3C: HTML Landmark Roles](https://www.w3.org/WAI/ARIA/apg/patterns/landmarks/)
