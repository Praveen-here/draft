# ∂raft

**Circle any math problem on your tablet, ask out loud, and ∂raft teaches you that exact step.**

Team **KingWraps** · PES University · Encode.ai Agentathon 2026 · Education track
Praveen Kumar D (lead) · T Raveendra · Sanjay M S · Darshana G

---

## Start here

| If you want to… | Read |
|---|---|
| Understand the project and the tools in plain words | [docs/TEAM_GUIDE.md](docs/TEAM_GUIDE.md) |
| Know the problem, the user and the pitch | [docs/PROJECT_OVERVIEW.md](docs/PROJECT_OVERVIEW.md) |
| See how we currently plan to build it (**draft**) | [docs/APPROACH_DRAFT.md](docs/APPROACH_DRAFT.md) |
| Check which services/keys we use, limits and costs | [docs/SERVICES_AND_KEYS.md](docs/SERVICES_AND_KEYS.md) |
| Set up your own accounts and keys | [docs/SETUP_GUIDE.md](docs/SETUP_GUIDE.md) |
| See what we already tested and the results | [docs/TEST_RESULTS.md](docs/TEST_RESULTS.md) |
| Know what to finish before the hackathon | [docs/PREP_CHECKLIST.md](docs/PREP_CHECKLIST.md) |
| See what we decided, why, and what's still open | [docs/DECISIONS.md](docs/DECISIONS.md) |
| Copy the tested "is this for me?" prompt | [docs/prompts/gate-prompt.md](docs/prompts/gate-prompt.md) |

## Status (31 Oct 2026)

- ✅ Idea, slides and pitch done
- ✅ Gemini, Gradium and Groq accounts and keys set up and tested
- ✅ "Is this for me?" gate tested on Groq: 14/14 correct, ~270 ms
- 🟡 Approach and architecture: **draft, not final**
- ✅ Landing page (Next.js 16 + Tailwind 4 + Motion): `src/app/page.tsx`, components in `src/components/landing/`
- ⬜ App features: not started (check the hackathon rules on prior work)

## Run it

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # production build check
```

## Rules for everyone

1. **Never commit or paste API keys.** They live only in `.env.local` (ignored by git), the password manager and Vercel.
2. **Never use `*_DEMO` keys while building.** They're saved for judging day.
3. When we decide something, add it to [docs/DECISIONS.md](docs/DECISIONS.md).
