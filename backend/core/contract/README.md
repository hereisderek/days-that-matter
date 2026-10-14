# Backend contract (generated)

Generated from `:core:model` by `./gradlew :core:model:generateContract (do not edit by hand)`. CI runs `./gradlew :core:model:checkContract` and fails
when these files differ from a fresh generation. Change the Kotlin model or the cases in
`core/model/src/jvmTest/.../contract/ContractCases.kt`, then regenerate.

- `api.schema.json`: JSON Schema (draft 2020-12) of the API request and response types.
  `backend/core/src/contract/api.ts` is generated from it (`npm run contract:types` in `backend/core`).
- `errors.json`: API error codes and their HTTP status.
- `plans.json`: the plan table. A limit of 0 means the plan does not include the feature; null means no limit.
- `limits.json`: fixed limits for every plan.
- `validation-vectors.json`: inputs and the normalized value or errors that `:core:model` validation gives.
- `merge-vectors.json`: patch apply, inverse, overwritten-field detection and revert.
