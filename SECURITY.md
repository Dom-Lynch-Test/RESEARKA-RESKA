# Security Policy

## Reporting a Vulnerability

The RESKA token team takes security vulnerabilities seriously. We appreciate your efforts to responsibly disclose your findings.

To report a security issue, please email security@researka.com with a description of the issue, the steps you took to create it, affected versions, and if known, mitigations. We will respond as quickly as possible.

Please follow these guidelines when reporting:

1. Provide detailed reports with reproducible steps
2. Include the version/commit where the vulnerability is present
3. If possible, include a proof of concept or exploit code

## Scope

The following are in scope for security vulnerability reports:
* The Smart Contracts in `/contracts/` directory
* Deployment scripts in `/scripts/` directory
* Token distribution mechanisms

## Security Measures in Place

The RESKA token project implements the following security measures:

* Branch protection for `main` branch requiring PRs and reviews
* Required status checks from our CI pipeline
* Code owners configuration for critical files
* Automated security scanning with Slither
* Required 2FA for all repository administrators
* Regular security audits before major releases

## Responsible Disclosure

We kindly ask you to:
* Allow us reasonable time to fix the issue before public disclosure
* Make a good faith effort to avoid privacy violations, data destruction, interruption, or degradation of our services
* Not access or modify data that does not belong to you

## Security Acknowledgements

We publicly thank security researchers who have responsibly disclosed vulnerabilities.
