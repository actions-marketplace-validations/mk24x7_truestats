# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2026-09-26

### Added

- `layout` input (CLI `--layout`, default `stats,languages;streak,pin`): cards
  in the same row are rendered at the height of the tallest one, with the title at
  the same top offset, content centred and the footer pinned to the bottom edge.
  Cards outside the layout keep their natural height; `pin` covers every pin card;
  `none` disables row sizing.
- The streak card has a footer defining a streak.

### Changed

- Shared layout constants for all cards: identical outer padding, title position,
  corner radius, border, footer style (12px) and footer bottom padding.
- Stats rows are 25px apart so the stats card pairs with the languages card
  without leaving large empty areas.
- The pin card's language, stars and forks row is its footer, aligned with the
  footers of other cards.
- README examples use the two-column layout.

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

[1.1.0]: https://github.com/mk24x7/truestats/releases/tag/v1.1.0
[1.0.1]: https://github.com/mk24x7/truestats/releases/tag/v1.0.1
[1.0.0]: https://github.com/mk24x7/truestats/releases/tag/v1.0.0
