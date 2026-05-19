- Do NOT re-read files unless necessary
- Reuse previously read context
- For large files, use offsets or partial reads

## Context Rules

- Cache previously read files
- Never reload entire files unless changed
- Prefer reading specific functions or blocks
- Use summaries instead of full file re-reads

Maintain internal memory:

- Files already read
- Functions already analyzed
- Avoid duplicate reads
