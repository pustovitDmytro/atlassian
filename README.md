# atlassian
jira and confluence command line interface.

[![Version][badge-vers]][npm]
[![Bundle size][npm-size-badge]][npm-size-url]
[![Downloads][npm-downloads-badge]][npm]

[![CodeFactor][codefactor-badge]][codefactor-url]
[![SonarCloud][sonarcloud-badge]][sonarcloud-url]
[![Codacy][codacy-badge]][codacy-url]
[![Total alerts][lgtm-alerts-badge]][lgtm-alerts-url]
[![Language grade][lgtm-lg-badge]][lgtm-lg-url]
[![Scrutinizer][scrutinizer-badge]][scrutinizer-url]

[![Dependencies][badge-deps]][npm]
[![Vulnerabilities][badge-vuln]](https://snyk.io/)
[![Build Status][tests-badge]][tests-url]
[![Coverage Status][badge-coverage]][url-coverage]

[![Commit activity][commit-activity-badge]][github]
[![License][badge-lic]][github]

## Table of Contents
  - [Requirements](#requirements)
  - [Installation](#installation)
  - [Usage](#usage)
  - [Contribute](#contribute)

## Requirements
[![Platform Status][appveyor-badge]][appveyor-url]

To use library you need to have [node](https://nodejs.org) and [npm](https://www.npmjs.com) installed in your machine:

* node `>=10`
* npm `>=6`

## Installation

To install the library run the following command

```bash
  npm i -g atlassian
```

## Usage

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

2) search issues that contains *memory leak* words:
   ```bash
      jira ls -s 'memory leak'
   ```
   where ```-s``` is a shortcut for ```--search``` or ```--grep```

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

Make the changes to the code and tests. Then commit to your branch. Be sure to follow the commit message conventions.

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
[coveralls]: https://coveralls.io/github/pustovitDmytro/atlassian?branch=master
[badge-deps]: https://img.shields.io/david/pustovitDmytro/atlassian.svg
[badge-vuln]: https://img.shields.io/snyk/vulnerabilities/npm/atlassian.svg?style=popout
[badge-vers]: https://img.shields.io/npm/v/atlassian.svg
[badge-lic]: https://img.shields.io/github/license/pustovitDmytro/atlassian.svg
[badge-coverage]: https://coveralls.io/repos/github/pustovitDmytro/atlassian/badge.svg?branch=master
[url-coverage]: https://coveralls.io/github/pustovitDmytro/atlassian?branch=master

[tests-badge]: https://img.shields.io/circleci/build/github/pustovitDmytro/atlassian
[tests-url]: https://app.circleci.com/pipelines/github/pustovitDmytro/atlassian

[codefactor-badge]: https://www.codefactor.io/repository/github/pustovitdmytro/atlassian/badge
[codefactor-url]: https://www.codefactor.io/repository/github/pustovitdmytro/atlassian

[commit-activity-badge]: https://img.shields.io/github/commit-activity/m/pustovitDmytro/atlassian

[scrutinizer-badge]: https://scrutinizer-ci.com/g/pustovitDmytro/atlassian/badges/quality-score.png?b=master
[scrutinizer-url]: https://scrutinizer-ci.com/g/pustovitDmytro/atlassian/?branch=master

[lgtm-lg-badge]: https://img.shields.io/lgtm/grade/javascript/g/pustovitDmytro/atlassian.svg?logo=lgtm&logoWidth=18
[lgtm-lg-url]: https://lgtm.com/projects/g/pustovitDmytro/atlassian/context:javascript

[lgtm-alerts-badge]: https://img.shields.io/lgtm/alerts/g/pustovitDmytro/atlassian.svg?logo=lgtm&logoWidth=18
[lgtm-alerts-url]: https://lgtm.com/projects/g/pustovitDmytro/atlassian/alerts/

[codacy-badge]: https://app.codacy.com/project/badge/Grade/8667aa23afaa4725854f098c4b5e8890
[codacy-url]: https://www.codacy.com/gh/pustovitDmytro/atlassian/dashboard?utm_source=github.com&amp;utm_medium=referral&amp;utm_content=pustovitDmytro/atlassian&amp;utm_campaign=Badge_Grade

[sonarcloud-badge]: https://sonarcloud.io/api/project_badges/measure?project=pustovitDmytro_atlassian&metric=alert_status
[sonarcloud-url]: https://sonarcloud.io/dashboard?id=pustovitDmytro_atlassian

[npm-downloads-badge]: https://img.shields.io/npm/dw/atlassian
[npm-size-badge]: https://img.shields.io/bundlephobia/min/atlassian
[npm-size-url]: https://bundlephobia.com/result?p=atlassian

[appveyor-badge]: https://ci.appveyor.com/api/projects/status/ux42y068m7c2yl2p/branch/master?svg=true
[appveyor-url]: https://ci.appveyor.com/project/pustovitDmytro/atlassian/branch/master


