# Releasing

This guide explains how releases are managed for the Adapt authoring tool.

## Overview

The project uses two release mechanisms:

- **Module releases** — Automated via semantic-release when changes are merged to master
- **Main repository releases** — Manual, allowing for thorough testing between releases

## Module releases

Individual modules (e.g., `adapt-authoring-core`, `adapt-authoring-auth`) are released automatically using [semantic-release](https://semantic-release.gitbook.io/).

### How it works

When a pull request is merged to the `master` branch, the release workflow:

1. Analyses commit messages to determine the release type
2. Bumps the version in `package.json`
3. Generates release notes from commit messages
4. Creates a GitHub release
5. Publishes the package to npm (via [trusted publishing](https://docs.npmjs.com/generating-provenance-statements))

### Version numbers

Releases follow [semantic versioning](https://semver.org/) (major.minor.patch). The version bump is determined by commit message prefixes:

| Prefix | Release type | Example |
| ------ | ------------ | ------- |
| `Fix:` | Patch (0.0.x) | Bug fixes |
| `Update:` | Minor (0.x.0) | New features, backwards-compatible changes |
| `Breaking:` | Major (x.0.0) | Breaking changes |
| `Docs:`, `Chore:` | No release | Documentation, maintenance |

See [contributing code](contributing-code) for detailed commit message guidelines.

### Configuration

Each module's release behaviour is configured in `package.json`, with the GitHub Actions workflow defined in `.github/workflows/releases.yml`.

## Main repository releases

The main `adapt-authoring` repository is released manually. This allows for a comprehensive testing cycle before each release.

### Release process

1. **Update dependencies** — Bump all `adapt-authoring-*` modules to their latest versions
2. **Testing** — Run the full test suite and perform manual testing
3. **Version bump** — Update the version in `package.json`
4. **Tag and release** — Create a git tag and GitHub release with release notes

### Permissions

Only users with collaborator status on the repository can publish releases.