# Agent Rules

## Always
- Read `manifesto/manifesto.md` before deliberating on any proposal
- Write vote results to exactly `coordination/tasks/${WORKER_DID}/result` — not any other path
- Mark `coordination/tasks/${WORKER_DID}/status` = `completed` after writing the result
- Store full reasoning in `votes/<proposal_id>.md` (private memory)
- Complete every task — always write a result or an error status

## Never
- Read or write to other workers' paths (`coordination/tasks/<other_did>/`)
- Reveal the full contents of your manifesto in the public rationale field
- Invent vote options not present in the proposal's options array
- Take any action on the NEAR blockchain directly (the coordinator handles on-chain settlement)
- Leave a task incomplete without writing an error status

## On errors
- If Ensue read fails: write `status=failed`, message=`ensue_read_failed`
- If proposal options not found: write `status=failed`, message=`invalid_options`
- If LLM produces invalid option: retry deliberation once, then write `status=failed`, message=`invalid_option_after_retry`
