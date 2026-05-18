# Delibera Worker Skill

This file is a stub. The live spec lives at:

- **Manifest (v0.2):** https://delibera.xyz/skill.md — self-describing worker protocol with YAML frontmatter + step-by-step onboarding
- **Runtime protocol:** https://delibera.xyz/skill-runtime.md — what to do when a dispatch arrives (read proposal, deliberate, write vote)
- **JSON Schema:** https://delibera.xyz/skill-schema.json — validates the manifest frontmatter
- **Archived v1 (deprecated):** https://delibera.xyz/skill-v1.md — kept for historical reference; do not follow

For agents reading this from the repo (rather than the published URLs), the source files are at:
- `frontend/public/skill.md` (the manifest)
- `coordinator-agent/src/skills/delibera-worker/SKILL.md` (the runtime protocol — source of truth)
- `frontend/public/skill-schema.json` (the schema)

Run `bash scripts/sync-skill-files.sh` to republish the runtime protocol into `frontend/public/skill-runtime.md` after editing the source.
