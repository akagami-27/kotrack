# KoTrack production login and schema recovery runbook

## Incident state and safety gate

Confirmed: the running backend connects to `postgresql.database.svc.cluster.local:5432`, database `og`. A read-only connection reached `10.42.0.36:5432`, the endpoint behind Service `postgresql` in namespace `database`; it is not the `postgresql-prd` Service. Production revision is `d3896ea15b0f`; the running image contains `a2190d9f7c31` as head. The `users.email` column is absent but is no longer a runtime application dependency. The database also lacks `drink_sessions.handler_id`, `drink_sessions.creator_role_at_creation`, and `session_requests.handler_id`.

**No recoverable database backup has been verified. Do not run any state-changing command until an approved backup exists, its restore has been tested in isolation, the target is re-confirmed, and the operator explicitly approves the change.** PVC binding/health and application health do not prove backup or schema correctness. Never print Kubernetes Secret contents, database URLs, credentials, or user data.

## 1. Reconfirm the target (read-only)

Use the current backend pod name, discovered afresh (sample pod shown):

```powershell
kubectl config current-context
kubectl -n app get pods -l app=kotrack-backend -o wide
kubectl -n app exec <backend-pod> -- python -c "from app.db.session import engine; u=engine.url; print('dialect='+engine.dialect.name); print('host='+str(u.host)); print('port='+str(u.port)); print('database='+str(u.database)); print('pool='+type(engine.pool).__name__)"
kubectl -n app exec <backend-pod> -- python -c "from sqlalchemy import text; from app.db.session import engine; c=engine.connect(); print('server='+str(c.execute(text('select inet_server_addr()::text, inet_server_port()')).one())); print('database='+str(c.execute(text('select current_database()')).scalar_one())); print('revision='+str(c.execute(text('select version_num from alembic_version')).scalar_one())); c.close()"
kubectl -n database get svc postgresql postgresql-prd -o custom-columns='NAME:.metadata.name,CLUSTER-IP:.spec.clusterIP,PORT:.spec.ports[0].port'
kubectl -n database get endpoints postgresql postgresql-prd -o custom-columns='NAME:.metadata.name,ADDRESSES:.subsets[*].addresses[*].ip,PORTS:.subsets[*].ports[*].port'
```

Proceed only if engine host/database, actual connected server, and Service mapping agree with the approved target. IPs and pods change; re-discover them.

## 2. Check revision and schema (read-only)

```powershell
kubectl -n app exec <backend-pod> -- python -m alembic heads
kubectl -n app exec <backend-pod> -- python -c "from sqlalchemy import inspect; from app.db.session import engine; i=inspect(engine); print('users='+','.join(c['name'] for c in i.get_columns('users'))); print('drink_sessions='+','.join(c['name'] for c in i.get_columns('drink_sessions'))); print('session_requests='+','.join(c['name'] for c in i.get_columns('session_requests'))); engine.dispose()"
```

The currently deployed image/revision claims recorded above predate this local change and were not rechecked. The reviewed source head is now `d172a0f61c42`, with the chain `d3896ea15b0f` -> `a2190d9f7c31` -> `c840a2b9d13f` -> `d172a0f61c42`. Confirm actual current revision and image digest before migration. If revisions differ or unrelated schema drift exists, stop; never stamp to conceal missing schema.

Historical migration `a2190d9f7c31` adds nullable session-handler columns, FKs/indexes, `SUPER_ADMIN`, and an optional legacy email column/index. Email is not mapped or selected by runtime code. The new `c840a2b9d13f` migration adds nullable rejection-audit fields. The forward migration `d172a0f61c42` adds code-free reset state and a short-lived browser-session hash, maps legacy requests, invalidates every old reset code hash, and retains decision/audit columns. Existing approved legacy requests are closed and must be re-requested; their approval audit remains. Verify against a disposable database before any real change.

Optional read-only preflight queries, only if the corresponding columns already exist:

```sql
-- Only if users.email exists; returns a count, no personal data.
SELECT count(*) FROM (
  SELECT lower(email) FROM users WHERE email IS NOT NULL
  GROUP BY lower(email) HAVING count(*) > 1
) AS duplicate_emails;

-- Only if handler_id columns exist.
SELECT count(*) FROM drink_sessions s LEFT JOIN users u ON u.id=s.handler_id
WHERE s.handler_id IS NOT NULL AND u.id IS NULL;
SELECT count(*) FROM session_requests r LEFT JOIN users u ON u.id=r.handler_id
WHERE r.handler_id IS NOT NULL AND u.id IS NULL;
```

Do not run the email query against the known incident schema while `email` is absent.

## 3. Backup and approval gate

No database backup mechanism was found in the repository or observed cluster CronJobs; the supplied Longhorn target is unavailable and no Longhorn backups/recurring jobs were found. Before changing production, the database owner must select an approved backup mechanism and destination, take a consistent backup, restore it to an isolated database/server, and verify that restore. Record a backup identifier and restore-test result without credentials or personal data. Obtain explicit change approval and a maintenance window. If a restorable backup cannot be verified, stop.

For the GitHub production Environment reviewer, the workflow input `backup_restore_test_id` is only a lookup/reference and an operator attestation; it is not verified by the workflow. Before approving, inspect the evidence and record (in the approved change system, not workflow logs):

- The exact database identity: cluster/context, namespace, Service/endpoint, database name, and observed Alembic revision. Confirm these against the approved change target.
- The backup identifier and completion timestamp in UTC, and evidence that the backup completed successfully and is consistent with the approved recovery point.
- The isolated restore target and UTC restore-test timestamp; confirm restore success and that the restored database can be opened and its schema/revision inspected. Do not restore over production.
- That the restored source revision and production's observed current Alembic revision match the reviewed migration path. Stop on drift or an unexpected revision.
- The reviewer identity, approval, and change/maintenance-window reference.

Do not enter database names, endpoints, credentials, user data, or backup contents in the Actions input or logs. A non-empty input, PVC state, successful application health, or successful backup command alone is not restore evidence.

## 4. Apply migration (state-changing; gated)

Use a one-shot Kubernetes Job with the **verified backend image**, image-pull secret, and only `DATABASE_URL` from Secret `kotrack-secrets`. Do not execute Alembic in the serving pod. Use a unique Job name and `backoffLimit: 0`. The job command must first assert the exact target, then inspect and migrate:

```sh
python -c "from app.db.session import engine; u=engine.url; assert u.host == 'postgresql.database.svc.cluster.local' and u.database == 'og', 'Refusing unexpected database target'; print('Verified target:', u.host, u.database)" \
  && python -m alembic current \
  && python -m alembic upgrade head \
  && python -m alembic current
```

Only `alembic upgrade head` changes schema. Review the rendered Job, exact image reference, Secret key reference, namespace, and target assertion before creating it. The currently observed image is `public-registry.smolelab.com/og/kotrack-backend:78d51e901d626131cf70747bcb8aa8dc9a760324`; re-verify it and confirm its migration head before use.

The enum label uses an autocommit block. A failed migration can leave `SUPER_ADMIN` present while the revision remains old; re-inspect before any retry. Do not stamp or blindly downgrade.

## 5. Verify after migration (read-only inspection; smoke-test requests are operational)

```powershell
kubectl -n app logs job/<migration-job-name>
kubectl -n app exec <backend-pod> -- python -c "from sqlalchemy import inspect,text; from app.db.session import engine; c=engine.connect(); i=inspect(engine); print('revision='+str(c.execute(text('select version_num from alembic_version')).scalar_one())); print('users='+','.join(x['name'] for x in i.get_columns('users'))); print('drink_sessions='+','.join(x['name'] for x in i.get_columns('drink_sessions'))); print('session_requests='+','.join(x['name'] for x in i.get_columns('session_requests'))); print('user_indexes='+','.join(x['name'] for x in i.get_indexes('users'))); print('enum='+','.join(c.execute(text(\"select e.enumlabel from pg_enum e join pg_type t on t.oid=e.enumtypid where t.typname='user_role' order by e.enumsortorder\")).scalars().all())); c.close(); engine.dispose()"
```

Confirm revision `d172a0f61c42`, expected session columns/indexes/FKs, enum label, reset status/session/completion fields, and rejection FK. The historical unused email/index and reset-code columns/index may remain; runtime does not map them. Exercise the public code-free request, Super Admin-only queue/decision, browser-session status, and `/api/auth/password-reset/complete`. Approval is bound to the original browser cookie; Super Admins must verify the requester through a trusted out-of-band process because the cookie proves browser continuity, not real-world identity. Confirm rejection remains auditable and cannot change the password.

## 6. Failure and recovery

- On Job failure, do not blindly retry. Inspect Job status and, read-only, revision, enum, columns, indexes and constraints. The enum may have committed separately.
- Do not run the migration downgrade automatically: it drops columns/data and cannot remove the enum label. Prefer a diagnosed forward fix.
- Restore the verified backup only with database-owner approval and a coordinated recovery plan. A pod restart or image rollback cannot restore missing columns.
- After schema upgrade, app rollback may also be unsafe if rows with `SUPER_ADMIN` were written because older ORM code may not decode the new enum value. Keep schema at head while assessing backward compatibility; do not roll back the database blindly.

## 7. GitHub workflow controls (configuration required; no production change until dispatched)

The local workflow now scans, validates, and builds without publishing on ordinary pushes. Publishing and production migration/deployment are guarded by manual dispatch on `main`, a true repository variable, an explicit operator attestation, and the `production` Environment. The migration Job has a 600-second deadline and the workflow waits a bounded 660 seconds; it refuses to overlap an active named KoTrack migration Job. A timeout remains an unknown outcome: inspect Job terminal state and actual Alembic revision before any retry.

1. Configure the GitHub `production` Environment with required reviewers and deployment branch restrictions to `main`.
2. Keep the repository variable `PRODUCTION_DEPLOYMENT_ENABLED` unset/false until backup/restore procedures, cluster RBAC, and an approved change are ready. Setting it to the exact string `true` enables the guarded manual path.
3. Confirm existing GitHub secrets `HARBOR_USERNAME`, `HARBOR_PASSWORD`, `RANCHER_ACCESS_KEY`, and `RANCHER_SECRET_KEY` are scoped appropriately and rotated if needed. No values belong in workflow inputs or logs.
4. Dispatch the workflow on `main` only after backup/restore validation. Set `production_change_approved` true and enter the approved backup/restore-test evidence identifier. The workflow's input is an operator attestation, not an automated backup validation.
5. The migration job checks the target hostname, database name, and current revision, and must complete before deploy can start. It is not a substitute for reviewing the exact target. Production images are deployed by the digest outputs from the corresponding build. The deploy job captures previous application image references and attempts to restore those references after rollout or smoke-test failure. That recovery affects application images only; it does not downgrade the database. No Kubernetes recovery was tested from this workstation.

No production environment, variable, or secret was configured as part of this repository change. Environment reviewers/branch restrictions and Harbor permissions/retention remain externally unverified. The workflow's digest references are immutable identifiers, but registry policy was not inspected. `k8s/frontend.yaml` now provides a Deployment/ClusterIP Service template; replace its explicit digest placeholder before applying. Ingress, hostname, and TLS remain platform-owned and were not found in the repository. The auto-recovery path is source-reviewed but not tested against Kubernetes.

## 8. Release image and frontend routing constraints

The release workflow builds both images from the same checked-out commit and deploys the build-produced digests; this is the release path for a consistent frontend/backend pair. Harbor must enforce tag immutability for commit-SHA tags on both `og/kotrack-frontend` and `og/kotrack-backend`, and CI credentials should have only the required repository push/pull rights. This policy was not inspected and must not be assumed enabled. Deployment uses digest references even if a SHA tag could later be moved.

`k8s/backend.yaml` and `k8s/frontend.yaml` contain explicit non-deployable digest placeholders. Do not apply either file unchanged. For initial workload creation, replace both placeholders with the frontend and backend `sha256` digests from the same successful `publish-images` workflow run, then review and apply the rendered manifests. For subsequent releases, use the workflow, which deploys the two image digests emitted by that run. Never substitute `latest` or separately selected tags. Harbor tag immutability remains recommended defense in depth and is not verified. The manifests establish namespace `app`, Deployments `kotrack-backend`/`kotrack-frontend`, containers `backend`/`frontend`, and Services on ports 8000/80. Nginx proxies `/api/` to `kotrack-backend:8000`; the release workflow checks these Service selectors/ports and probes `/api/health` through the frontend before success. The frontend Service is ClusterIP only. The platform owner must supply or verify Ingress, hostname, TLS, and external routing. No Kubernetes cluster test was performed.
