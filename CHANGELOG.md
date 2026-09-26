# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.1] - 2026-09-26

### Added

- `exclude_archived` input (default `true`, CLI `--exclude-archived`): archived
  repositories are dropped from the languages and stars aggregation, so old
  mirrors no longer dominate the languages card. `exclude_repos` is unchanged.

### Changed

- The languages card footer now reads "Archived and forks excluded." when archived
  repositories are skipped.

## [1.0.0] - 2026-09-26

### Added

- GitHub Action (`node24`) and local CLI that render profile cards as SVG files.
- `stats` card: all-time commits including private contributions, pull requests,
  issues, code reviews, stars earned, followers, repositories contributed to.
- `languages` card: top languages by bytes across every repository the token can
  see, stacked bar plus legend, embedded GitHub language colours.
- `streak` card: contributions this year, current streak and longest streak.
- `pin` card: one card per requested repository.
- Themes `light`, `dark`, `tokyonight`, `transparent`, plus explicit colour overrides.
- Commit and push of changed cards as `github-actions[bot]`, skipped when unchanged.
- GraphQL client with pagination, retries and clear rate-limit messages, and a log
  warning when the token cannot see private repositories.
- Zero runtime dependencies; `dist/index.js` built by a small bundler script.

[1.0.1]: https://github.com/mk24x7/truestats/releases/tag/v1.0.1
[1.0.0]: https://github.com/mk24x7/truestats/releases/tag/v1.0.0
