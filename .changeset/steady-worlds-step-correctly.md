---
"@cyclonium/physics-2d": minor
"@cyclonium/core": patch
---

Share fixed-rate time accumulation between component and physics updates, run physics at its configured rate, honor each physics step's delta time, and clamp overloaded update input before accumulation while preserving prior fractional time.
