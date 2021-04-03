# atlassian
**atlassian** jira and confluence command line interface.

[![Version][badge-vers]][npm]
[![Dependencies][badge-deps]][npm]
[![Vulnerabilities][badge-vuln]](https://snyk.io/)
[![Build Status][badge-tests]][travis]
[![Coverage Status][badge-coverage]](https://coveralls.io/github/pustovitDmytro/atlassian?branch=master)
[![License][badge-lic]][github]

## Table of Contents
  - [Requirements](#requirements)
  - [Installation](#installation)
  - [Usage](#usage)
  - [Contribute](#contribute)

## Requirements
To use library you need to have [node](https://nodejs.org) and [npm](https://www.npmjs.com) installed in your machine:

* node `6.0+`
* npm `3.0+`

## Installation

To install the library run following command

```bash
  npm i -g atlassian
```

## Jira cli

### List Tasks

Generally, ```jira list``` command can help to list all tasks

```
jira.js list [--dev] [--mine] [--search=<search>] [--sprint=<sprint>] [--verbose]
[--profile=<profile>]

List Tasks

Options:
  -h, --help                Show help                                                 [boolean]
      --version             Show version number                                       [boolean]
  -v, --verbose             verbose logs                                              [boolean]
  -p, --profile             specify profile name                                       [string]
  -d, --dev, --development  filter only tasks in development                          [boolean]
  -m, --mine, --my          filter only mine issues                                   [boolean]
  -s, --search, --grep      search issues by summary                                   [string]
      --sprint              specify sprints for filter
                                           [array] [choices: "all", "open"] [default: ["open"]]
```

Some common examples:

1) get all mine tasks in development for open sprint:
   ```bash
      jira ls -dm
   ```
   where ```ls``` is alias for ```list``` command and ```-dm``` means *mine* tasks in *dev* status

2) search issues which contains *memory leak* words:
   ```bash
      jira ls -s 'memory leak'
   ```
   where ```-s``` is shortcut for ```--search``` or ```--grep```

### Send issue(s) to testing

```
jira.js test [--verbose] [--profile=<profile>] <issueId...>

Send task to testing

Options:
  -h, --help     Show help                                                            [boolean]
      --version  Show version number                                                  [boolean]
  -v, --verbose  verbose logs                                                         [boolean]
  -p, --profile  specify profile name                                                  [string]
      --issueId  id(s) of task                                                          [array]
```

## Contribute

Make the changes to the code and tests and then commit to your branch. Be sure to follow the commit message conventions.

Commit message summaries must follow this basic format:
```
  Tag: Message (fixes #1234)
```

The Tag is one of the following:
* **Fix** - for a bug fix.
* **Update** - for a backwards-compatible enhancement.
* **Breaking** - for a backwards-incompatible enhancement.
* **Docs** - changes to documentation only.
* **Build** - changes to build process only.
* **New** - implemented a new feature.
* **Upgrade** - for a dependency upgrade.
* **Chore** - for tests, refactor, style, etc.

The message summary should be a one-sentence description of the change. The issue number should be mentioned at the end.


[npm]: https://www.npmjs.com/package/atlassian
[github]: https://github.com/pustovitDmytro/atlassian
[travis]: https://travis-ci.com/pustovitDmytro/atlassian
[coveralls]: https://coveralls.io/github/pustovitDmytro/atlassian?branch=master
[badge-deps]: https://img.shields.io/david/pustovitDmytro/atlassian.svg
[badge-tests]: https://img.shields.io/travis/pustovitDmytro/atlassian.svg
[badge-vuln]: https://img.shields.io/snyk/vulnerabilities/npm/atlassian.svg?style=popout
[badge-vers]: https://img.shields.io/npm/v/atlassian.svg
[badge-lic]: https://img.shields.io/github/license/pustovitDmytro/atlassian.svg
[badge-coverage]: https://coveralls.io/repos/github/pustovitDmytro/atlassian/badge.svg?branch=master