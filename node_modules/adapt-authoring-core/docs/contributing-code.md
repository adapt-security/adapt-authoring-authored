# Contributing code

This guide covers everything you need to know about contributing code to the Adapt authoring tool repositories.

## Quick navigation

- [Finding work](#finding-work)
- [Setting up](#setting-up)
- [Making changes](#making-changes)
- [Documentation](#documentation)
- [Commit messages](#commit-messages)
- [Submitting a pull request](#submitting-a-pull-request)
- [Code review](#code-review)

## Finding work

Pick an issue from one of the [adapt-security](https://github.com/adapt-security) repositories, or create a new one if you've found a bug or have a feature idea.

### Difficulty labels

Issues are labelled with difficulty ratings to help you find suitable work:

| Label | Description |
|-------|-------------|
| `D: beginner` | Simple fixes, good for first-time contributors |
| `D: easy` | Straightforward changes with limited scope |
| `D: medium` | Moderate complexity, requires Node.js experience |
| `D: hard` | Complex changes spanning multiple areas |
| `D: insane` | Major architectural changes, requires deep codebase knowledge |

If you're new to the project, start with `D: beginner` or `D: easy` issues. For larger features or complex fixes, please discuss your approach with the core team before starting work.

## Setting up

### Fork or branch?

**Core team members** have write access to the repositories and can create branches directly.

**External contributors** should fork the repository to their own GitHub account and work from there.

### Create a branch

Create a branch for your work, named after the issue number:

```bash
# For core team (direct branch)
git checkout -b issue/1234 origin/master

# For external contributors (from your fork)
git checkout -b issue/1234
```

Always branch from `master` — this is the only long-lived branch.

## Making changes

### Code style

All code must pass the [Standard.js](https://standardjs.com/) linter. Run it locally before committing:

```bash
npx standard
```

### Tests

If you're adding new functionality, add tests to cover it. Run the test suite to make sure everything passes:

```bash
npm test
```

### Documentation

Keep documentation up to date with your changes:

- **Code comments** — Add or update JSDoc comments for any new or modified functions, classes, or methods
- **Manual pages** — If you're adding a feature or changing behaviour, update the relevant markdown guides in `docs/`
- **REST API** — For API changes, ensure route metadata is accurate so the generated API docs stay current

Good documentation helps others understand and use your work. See [Writing Documentation](writing-documentation) for more details.


## Commit messages

We use [semantic-release](https://semantic-release.gitbook.io/) to automate releases, so commit messages must follow a specific format. The commit prefix determines the type of release:

| Prefix | Release type | Use for |
|--------|--------------|---------|
| `Fix:` | Patch (0.0.x) | Bug fixes |
| `Update:` | Minor (0.x.0) | Backwards-compatible enhancements to existing features |
| `New:` | Minor (0.x.0) | New features |
| `Breaking:` | Major (x.0.0) | Breaking changes |
| `Docs:` | No release | Documentation only |
| `Build:` | No release | Build process changes |
| `Upgrade:` | Varies | Dependency upgrades |
| `Chore:` | No release | Maintenance, refactoring, tests |

### Format

```
Prefix: Short description (fixes #1234)
```

Use `(fixes #1234)` when the commit fully resolves an issue, or `(refs #1234)` for partial progress. Keep the first line under 72 characters.

Add a longer explanation on subsequent lines if needed:

```
Prefix: Short description (fixes #1234)

Longer explanation if needed. Wrap at 72 characters.
```

### Examples

```
Fix: Prevent crash when uploading empty file (fixes #1234)
```

```
Update: Add bulk delete endpoint for assets (fixes #5678)
```

```
Breaking: Remove deprecated /api/v1 endpoints (fixes #9012)

The v1 API has been removed. All clients should migrate to /api.
```

### Tips

- Use the imperative mood ("Add feature" not "Added feature")
- Keep the first line under 72 characters
- Reference the issue in the first line with `(fixes #N)` or `(refs #N)`
- For breaking changes, explain what users need to do to migrate

## Submitting a pull request

### Before submitting

- [ ] Code passes linting (`npx standard`)
- [ ] Tests pass (`npm test`)
- [ ] Documentation is updated (if applicable)
- [ ] Commit messages follow the format above
- [ ] Branch is up to date with master

### Creating the PR

1. Push your branch to GitHub
2. Open a pull request against the `master` branch
3. Fill in the PR template, linking to the issue it addresses
4. Request reviews from the core team

For external contributors, submit the PR from your fork to the upstream repository.

## Code review

All code must be reviewed before merging.

### Requirements

For a PR to be merged:

- **2 approvals required** — At least two reviewers must approve
- **CI checks must pass** — Linting and tests must succeed
- **No unresolved conversations** — All review comments must be addressed

### Review criteria

Reviewers will check that:

- The code does what the issue describes
- The implementation approach is sound
- Code style follows project standards
- Tests are included where appropriate
- Documentation is added/updated where necessary
- No negative side effects are anticipated
- Commit messages follow the required format

### Responding to feedback

If changes are requested:

1. Make the requested changes in new commits
2. Push to the same branch (the PR updates automatically)
3. Reply to review comments explaining what you changed
4. Request re-review when ready

### After approval

Once approved, a core team member will merge your PR. Thanks for contributing! :tada: