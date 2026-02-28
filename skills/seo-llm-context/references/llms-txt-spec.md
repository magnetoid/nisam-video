# llms.txt Specification Reference

## What is llms.txt?

`llms.txt` is a proposed standard for providing LLM-friendly content at the root of a website. It gives AI crawlers a clean, structured summary of what the site offers, similar to how `robots.txt` communicates with traditional crawlers.

## File Location

Place the file at the root of your public directory so it's accessible at:
```
https://yourdomain.com/llms.txt
```

## Format

The file should be written in **Markdown** and include:

1. **Site name and tagline** (H1 + blockquote)
2. **Brief site description** (1-2 paragraphs)
3. **Key pages/sections** (links with one-line descriptions)
4. **Optional: key topics, content types, or API info**

## Template

```markdown
# Site Name

> One-line tagline or mission.

Brief description of what this site does and who it serves. This should
be 1-2 paragraphs of clear, factual prose.

## Main Sections
- [Home](https://example.com/) — Overview and value proposition
- [Blog](https://example.com/blog) — Articles on [topic]
- [Docs](https://example.com/docs) — Technical documentation
- [API](https://example.com/api) — REST API reference
- [Pricing](https://example.com/pricing) — Plans and features

## Key Topics
- Topic One
- Topic Two
- Topic Three

## Contact
- Email: hello@example.com
- Twitter: @example
```

## Best Practices

- **Keep it concise** — aim for under 500 words
- **Use absolute URLs** for all links
- **Update regularly** — stale content reduces trust
- **No marketing fluff** — AI crawlers prefer factual, structured content
- **Include only public pages** — don't link to authenticated routes

## Extended Format: llms-full.txt

For sites with extensive content, you can also provide a `llms-full.txt` with more detail:

```
https://yourdomain.com/llms-full.txt
```

This can include full page descriptions, content taxonomies, and more granular navigation.

## Resources
- [llms.txt Proposal](https://llmstxt.org/)
- [Perplexity documentation on site indexing](https://docs.perplexity.ai/)
