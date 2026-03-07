# Adapt Authoring Tool Developer guides

Welcome to the technical documentation for the Adapt authoring tool — a web-based application for creating responsive, multi-device e-learning content built on the [Adapt Framework](https://github.com/adaptlearning/adapt_framework).

The authoring tool provides a user-friendly interface for building courses without needing to write code, while its modular architecture gives developers the flexibility to extend and customise virtually every aspect of the system. Whether you're looking to build custom plugins, integrate with external services, or contribute to the core codebase, you're in the right place.

## What makes it tick

The authoring tool is built on a few key principles:

- **Modular by design** — The entire application is composed of discrete modules that can be swapped, extended, or replaced. Need custom authentication? Write an auth plugin. Want to store data differently? Create a new database adapter.

- **Schema-driven** — Content types, validation rules, and UI forms are all defined using JSON schemas. This means you can add new content types or modify existing ones without touching application code.

- **RESTful API** — Every feature is accessible via a comprehensive REST API, making it straightforward to integrate with other systems or build custom tooling.

- **Built for collaboration** — Multi-user support with role-based permissions lets teams work together on courses with appropriate access controls.

## About this documentation

This documentation covers the technical side of the authoring tool — how it works under the hood and how to extend it. You'll find guides on writing custom modules, working with the database, creating schemas, and contributing to the project.

If you're looking for help using the authoring tool to create courses, check out the user guides on the [Adapt Learning community site](https://www.adaptlearning.org/).

## Where to start

New to the codebase? Here are some good starting points:

- **[Folder Structure](folder-structure)** — Get familiar with how the application is organised
- **[Writing a Module](writing-a-module)** — Learn the basics of creating your own module
- **[Schemas Introduction](schemas-introduction)** — Understand how schemas drive the application
- **[Hooks](hooks)** — See how to tap into the application lifecycle

## Get involved

The Adapt authoring tool is open source and we welcome contributions. You can find the source code and report issues on GitHub:

- [adapt-security](https://github.com/adapt-security) — Authoring tool repositories
- [adaptlearning](https://github.com/adaptlearning) — Adapt Framework and community plugins

## Contributors

A huge thank you to everyone who has contributed to the Adapt authoring tool. This project wouldn't be possible without the time and effort of our community.

{{{CONTRIBUTORS}}}

<div class="big-text">Happy coding!</div>