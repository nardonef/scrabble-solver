# Scrabble Solver

Take a photo of a Scrabble board and rack; the app uses Claude's vision to
detect the board and tiles, lets you review/correct the result, then finds
the highest-scoring legal play.

## Setup

Requires an `ANTHROPIC_API_KEY` environment variable (used to call the
Anthropic API for board scanning). Set it in your shell or in a `.env.local`
file at the project root.

```bash
npm install
npm run dev
```
