# Release checklist for 0.1.0-rc.1

The first release candidate is a deliberate maintainer operation. Do not automate or publish it
until every blocking item is complete.

## Blocking review

- [ ] Complete `maintainer-review-0.1.0.md` and record the maintainer's notes in the release PR.
- [ ] Install the exact tarball into a real consuming application and exercise both the success and
      failure paths that the application will use.
- [ ] Confirm the public package name immediately before publishing. An `E404` registry lookup is
      provisional availability, not a reservation.
- [ ] Confirm the npm owner account, public access, two-factor authentication, and intended
      `next` dist-tag.
- [ ] Review `security-review-0.1.0.md`, all residual risks, and all re-review triggers.
- [ ] Approve removal of the package's `private` guard in the release-candidate PR.

## Reproducible verification

From a clean checkout of the exact commit:

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm check
pnpm benchmark
pnpm pack --json --dry-run
```

Then inspect the tarball manifest and verify that the working tree remains clean. The package's
`prepublishOnly` hook repeats `pnpm check`; it is a guard, not a substitute for the review above.

## Publication — explicit approval required

Only after the blocking review is complete:

1. Publish the exact reviewed commit with the `next` dist-tag.
2. Install `rag-citation-check@0.1.0-rc.1` from the public registry in a clean project.
3. Verify package metadata, provenance status, both module formats, and the documented quickstart.
4. Create the matching `v0.1.0-rc.1` Git tag and GitHub prerelease from the same commit.
5. Announce only the properties actually established by the tests and security review.

If publication or post-publication verification is ambiguous, stop. Do not repeat a write blindly;
first determine whether the package version, tag, or release already exists.
