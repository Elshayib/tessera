---
"@tessera/engine": patch
"@tessera/ui": patch
"@tessera/storage": patch
"@tessera/web": patch
---

Skip no-op viewport resizes so the empty visual baseline can settle; cover extra branches so CI meets the 90% threshold.
