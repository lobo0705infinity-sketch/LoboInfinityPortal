# Bounded snapshot publication

The complete public snapshot is no longer sent in a single request. The Apps
Script exporter uploads 512,000-byte chunks as base64, then submits a manifest.
Every encoded request is checked against a 1 MB budget. Growing history therefore
does not consume the former 4 MB aggregate request allowance.

The authenticated publisher supports `action: "chunk"` with `snapshotId`,
`sourceCutoff`, `artifact`, `index`, and `content`. An artifact contains its
allowlisted `filename`, UTF-8 `byteCount`, SHA-256 `contentHash`, and `chunks`.
Chunk indices start at zero. Repeating an identical chunk is safe; different
bytes at the same immutable path are rejected.

`action: "finalize"` takes all 15 artifact manifests and `activate: true`.
It reads all chunks, checks size and SHA-256, parses each JSON envelope, and
verifies the snapshot ID and cutoff. Only after every final immutable dataset
exists does it replace `current.json`. Missing or corrupted uploads leave the
live pointer untouched. An older source cutoff cannot replace a newer snapshot.

Legacy complete-file requests remain supported within the 4 MB **request**
budget. A single assembled dataset has a separate 64 MB resource safety limit;
approaching that limit requires partitioning that dataset rather than increasing
the transport request budget.

Scheduled refreshes persist `PUBLIC_SNAPSHOT_LAST_PUBLICATION_STATUS` and throw
on failure so Apps Script trigger failure reporting can surface the failure.
Existing trigger notification preferences determine whether an email is sent.

Deploy the Vercel publisher before updating the Apps Script exporter. Then run
`runPublishPublicSnapshotV1Proof` to recover the latest validated snapshot, and
verify the live pointer and both game detail pages. Backend files in GitHub alone
do not update the live Apps Script project.

Validation: `npm run test:public-snapshot-publication`,
`npm run test:public-snapshot-exporter`, and
`npm run release:apps-script:syntax`. The chunk regression covers a >5 MB
Unicode dataset, repeated uploads, missing chunks, corrupted chunks, incomplete
manifests, and preservation of the live pointer on failure.

The authenticated automation queue worker now checks snapshot maintenance before
processing announcements. If the last verified publication or successful refresh
is at least 15 minutes old, it invokes the existing protected
`refreshArmyIntelligence` API with an empty snapshot list and
`publishPublicSnapshot=true`. The credential stays inside the deployed runtime;
local secret export and Apps Script Execution API access are unnecessary.

It verifies the publisher receipt against the live pointer before allowing queue
processing. `public-snapshots/refresh-status.json` records only the snapshot ID and
last successful refresh time, so unchanged data is throttled across cold starts.
Failures do not record success and are retried at the next scheduled invocation.
Actual refresh latency also depends on the installed scheduler cadence.

Queue maintenance recovers exhausted Discord game jobs whose saved error is the
identified legacy `Unexpected token 'A'` plain-text report-server response. It
resets that pre-delivery retry budget once, preserves the previous failure in the
reason field, and retains the same queue ID and delivery deduplication. Sent jobs
and unrelated webhook failures are untouched. The backend recovery addition must
be deployed through clasp; publication maintenance itself runs in Vercel.

Additional validation: `npm run test:game-automation-background` covers stale and
unchanged refreshes, false success receipts, failed uploads, and one-time queue
recovery without changing delivered or exhausted webhook jobs.
