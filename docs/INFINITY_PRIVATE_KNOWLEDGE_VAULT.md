# Infinity Private Knowledge Vault

## Purpose

The Infinity Private Knowledge Vault is the internal knowledge service for Infinity AI. It separates public, licensed source material from private Infinity research, prompts, user notes, embeddings, conversations, product plans, and generated conclusions.

The public repository is not itself a secure vault. Production knowledge must be stored behind authenticated server-side services with no direct public file access.

## Knowledge classes

Every record must have one class:

- `public_reference` — public or licensed material that may be cited and indexed.
- `infinity_original` — original Infinity writing, research, designs, and system documentation.
- `user_private` — material visible only to its owner and explicitly authorized Infinity services.
- `partner_restricted` — studio, merchant, researcher, or partner material governed by an agreement.
- `system_secret` — prompts, credentials, security rules, signing material, and operational configuration. Never returned through ordinary search.

Public reference material remains subject to its original license and attribution requirements. Moving it into a private service does not make it exclusive property.

## Clean record format

```json
{
  "knowledgeId": "knowledge_01J...",
  "title": "Clean descriptive title",
  "summary": "Short factual description",
  "bodyLocation": "vault://encrypted/object/path",
  "knowledgeClass": "infinity_original",
  "ownerId": "infinity",
  "sourceRecords": ["source_01J..."],
  "licenseRecord": "license_01J...",
  "tags": ["ai", "research"],
  "allowedAgents": ["infinity-research", "infinity-builder"],
  "allowedPurposes": ["answer", "research", "design"],
  "version": 1,
  "integrityHash": "sha256:...",
  "createdAt": "ISO-8601",
  "updatedAt": "ISO-8601"
}
```

Titles, tags, and summaries may be cleaned and normalized. Source attribution, licensing, ownership, and version history must not be removed.

## Access model

Access is denied by default. A request must prove:

1. An authenticated user or service identity.
2. An authorized Infinity agent identity.
3. A permitted purpose.
4. Access to the requested knowledge class.
5. A valid session and unexpired authorization.

The browser must never receive database credentials, model-provider keys, encryption keys, signing keys, or unrestricted vault exports.

## Required security controls

- Private production repository or private deployment environment.
- Server-side authentication and role-based access control.
- Per-user and per-partner authorization boundaries.
- Encryption in transit and at rest.
- Secrets stored in a managed secret store, never committed to Git.
- Append-only audit events for reads, writes, exports, and deletions.
- Signed version records and integrity hashes.
- Rate limits, request-size limits, and abuse detection.
- Input validation and output encoding.
- No arbitrary executable uploads.
- Malware scanning for attachments.
- Backup, recovery, revocation, and key rotation.
- Separate development, test, and production data.
- Retrieval limits so an AI receives only the minimum relevant records.

## AI retrieval boundary

Infinity AI should not receive the entire vault for every question. The retrieval service should:

1. Authenticate the caller.
2. Classify the request purpose.
3. Search only authorized collections.
4. Return a small set of relevant excerpts.
5. Attach source, license, owner, and version metadata.
6. Log which records were supplied to which agent.
7. Prevent restricted records from entering public answers.

## Public fork migration

The existing public project can remain a development shell and attribution record. Production migration should:

1. Preserve the upstream license and source history.
2. Remove real knowledge data from the public repository.
3. Keep only schemas, example records, UI code, and documentation publicly when desired.
4. Create a separate private repository or private managed database for production.
5. Import only material Infinity is permitted to store and use.
6. Mark each imported record with source and license metadata.
7. Add original Infinity knowledge as separately owned records.
8. Rotate any credential ever committed or exposed.

## API boundary

Public clients should call a narrow authenticated API. Recommended routes:

- `POST /api/session`
- `POST /api/knowledge/search`
- `GET /api/knowledge/:id`
- `POST /api/knowledge`
- `PATCH /api/knowledge/:id`
- `POST /api/knowledge/:id/version`
- `POST /api/ai/query`
- `GET /api/audit/my-activity`

Create, update, delete, bulk export, partner access, and system administration require distinct permissions.

## Naming and interface direction

Product title:

**Infinity AI Knowledge Vault**

Interface sections:

- Ask Infinity
- Knowledge Library
- Research Workbench
- Source and License Inspector
- Private Collections
- Agent Permissions
- Version History
- Security and Audit

The visual design should use the shared Infinity design system, mobile-first navigation, clear privacy labels, and small star editing controls only where the user has permission.

## Immediate implementation order

1. Replace JSON-file production storage with a database and encrypted object storage.
2. Add authentication before every knowledge and AI endpoint.
3. Add ownership, class, source, license, and allowed-agent fields.
4. Remove unrestricted full-vault injection into model prompts.
5. Add scoped retrieval and audit logging.
6. Build import tooling that preserves provenance and rejects unsupported licenses.
7. Deploy the production service privately.
8. Test authorization, prompt injection resistance, data leakage, backup recovery, and key rotation.

## Security statement

No system is impossible to attack. The goal is to make private knowledge inaccessible without authorization, limit what any single compromised component can expose, detect misuse, revoke access, and recover safely.