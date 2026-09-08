# Security Policy

## Supported versions

Only the current `main` branch is supported with security fixes.

## Reporting a vulnerability

Do not report security vulnerabilities in public issues. Use GitHub private vulnerability reporting for this repository, or contact the repository owner through a private channel. Include reproduction steps, impact, and affected component when possible.

## Security controls

Pull requests are expected to pass the Quality workflow: Swift linting and tests, Deno formatting/linting/type-checking, CodeQL, and Gitleaks. Production Edge Function deployments require the protected `production` GitHub environment.

Secrets are held in GitHub Environments and Supabase secrets. They must never be committed to the repository or embedded in the mobile client.