# Checking FHIR element mappings

```
bun install openai
bun install html-to-text
bun run index.ts > r4-r5.out
cat r4-r5.out  | jq -c 'select(. != null) | select(.potentialR5Targets[]?.qualityOfMatch == "strong")' | jq -s  > r4-r5.json
```
