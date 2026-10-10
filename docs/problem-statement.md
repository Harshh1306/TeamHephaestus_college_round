# Incognito: Speak Without Being Seen

## Backstory
Honest feedback about managers, teachers, and institutions is often suppressed because people fear retaliation. Traditional reporting systems rely on administrators to protect identities, while anonymous platforms struggle with fake submissions and abuse.

The challenge is to verify membership without revealing who submitted a report, even to the administrator.

## Problem Statement
Develop Incognito, a privacy-preserving reporting system that allows verified members to submit anonymous reports without revealing their identities.

The system must prevent outsiders and duplicate submissions while ensuring reports from the same member cannot be linked across different topics. It must also support abuse prevention without compromising anonymity.

Teams must demonstrate resistance to forged credentials, duplicate submissions, report correlation, and unauthorized identity disclosure.

## Key Features

- **Anonymous Membership Proof:** Verify that a reporter possesses a valid membership credential without disclosing their identity.
- **Unlinkable Submissions:** Prevent reports from being correlated across different topics or reporting categories.
- **Privacy-Preserving Duplicate Control:** Enforce per-member submission limits using topic-scoped cryptographic nullifiers or an equivalent mechanism.
- **Administrator Privacy:** Prevent administrators from directly recovering reporter identities from stored reports and verification records.
- **Anonymous Abuse Prevention:** Support content moderation, rate limiting, and credential revocation without routinely exposing reporter identities.
- **Metadata Protection:** Identify and mitigate identity leakage through application logs, timestamps, network metadata, and submission patterns.
- **Security Evaluation:** Test forged credentials, duplicate submissions, cross-topic correlation, unauthorized administrative access, and relevant collusion scenarios. Document the guarantees achieved, limitations, and remaining attack surfaces.
