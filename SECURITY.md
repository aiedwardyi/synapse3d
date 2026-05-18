# Security Policy

## Supported Versions

Security fixes target the current `main` branch and the latest tagged release.

## Reporting a Vulnerability

Use GitHub's private vulnerability reporting flow if it is enabled for this repository. If it is not available, open a public issue titled `Security disclosure request` without exploit details, and the maintainer will arrange a private channel.

Please include:

- Affected browser, operating system, and app version or commit
- Steps to reproduce the issue
- The impact you believe the issue has
- Whether the report involves vault file access, webcam handling, dependency compromise, XSS, or another class of issue

## Security Model

Synapse3D is a client-side app. It does not run a backend service, upload vault contents, or send webcam frames to an application server. The main trust boundaries are:

- The browser's File System Access permission prompt
- The browser's camera permission prompt
- Third-party client libraries loaded through the bundled Vite build
- User-provided Markdown content rendered into the app UI

Reports that cross one of those boundaries are in scope. General feature requests, unsupported browsers, and issues requiring already-compromised local machines are out of scope for security disclosure.
