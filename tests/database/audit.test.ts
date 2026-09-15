import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { asAnon, asUser, createDbClient, expectStatementToFail, inTransaction } from './helpers/db'
import { authUserIds, branchIds, profileIds, restaurantIds } from './helpers/fixtures'

/**
 * Audit foundation tests (spec 002 US3, FR-012/FR-013, SC-004;
 * contracts/database-functions.md).
 *
 * Preconditions: migrated + seeded cloud dev DB. All mutations run inside
 * rolled-back transactions.
 */

const client = createDbClient()

beforeAll(async () => {
  await client.connect()
})

afterAll(async () => {
  await client.end()
})

/** record_audit parameter order (contracts): actor, action, resource type, resource id, reason, restaurant, branch. */
function auditCall(
  actor: string | null,
  action: string | null,
  resourceType: string | null,
  resourceId: string | null,
  reason: string | null,
  restaurant: string | null,
  branch: string | null,
): unknown[] {
  return [actor, action, resourceType, resourceId, reason, restaurant, branch]
}

/** Assert record_audit rejects the call with P0001 naming the missing field. */
async function expectAuditValidationError(values: unknown[], messagePart: string) {
  await client.query('savepoint audit_check')
  try {
    await client.query('select private.record_audit($1, $2, $3, $4, $5, $6, $7)', values)
  } catch (error) {
    await client.query('rollback to savepoint audit_check')
    const pgError = error as { code?: string; message: string }
    expect(pgError.code).toBe('P0001')
    expect(pgError.message).toContain(messagePart)
    return
  }
  await client.query('rollback to savepoint audit_check')
  throw new Error(`expected record_audit to reject with: ${messagePart}`)
}

describe('audit_log shape (data-model.md)', () => {
  it('has the declared columns, types, and nullability', async () => {
    const { rows } = await client.query(
      `select column_name, data_type, is_nullable
       from information_schema.columns
       where table_schema = 'public' and table_name = 'audit_log'
       order by ordinal_position`,
    )
    expect(rows.map((r) => [r.column_name, r.data_type, r.is_nullable])).toEqual([
      ['id', 'bigint', 'NO'],
      ['actor_profile_id', 'uuid', 'NO'],
      ['action', 'text', 'NO'],
      ['resource_type', 'text', 'NO'],
      ['resource_id', 'text', 'NO'],
      ['reason', 'text', 'YES'],
      ['restaurant_id', 'uuid', 'NO'],
      ['branch_id', 'uuid', 'YES'],
      ['created_at', 'timestamp with time zone', 'NO'],
    ])
  })

  it('RLS is enabled with no policies and no client grants', async () => {
    const rls = await client.query(
      `select relrowsecurity from pg_class
       where relnamespace = 'public'::regnamespace and relname = 'audit_log'`,
    )
    expect(rls.rows[0].relrowsecurity).toBe(true)

    const policies = await client.query(
      `select count(*)::int as n from pg_policies
       where schemaname = 'public' and tablename = 'audit_log'`,
    )
    expect(policies.rows[0].n).toBe(0)

    const grants = await client.query(
      `select grantee, privilege_type from information_schema.role_table_grants
       where table_schema = 'public' and table_name = 'audit_log'
         and grantee in ('anon', 'authenticated')
       order by grantee, privilege_type`,
    )
    expect(grants.rows).toEqual([])
  })
})

describe('record_audit contract (FR-012, US3 scenarios 1 and 3)', () => {
  it('persists a complete record and returns the identity value', async () => {
    await inTransaction(client, async () => {
      const { rows } = await client.query(
        'select private.record_audit($1, $2, $3, $4, $5, $6, $7) as id',
        auditCall(
          profileIds.alice,
          'test.demo_action',
          'restaurant',
          restaurantIds.blueOlive,
          'demonstration reason',
          restaurantIds.blueOlive,
          branchIds.downtown,
        ),
      )
      const id = rows[0].id as string
      expect(id).toBeTruthy()

      const record = await client.query('select * from public.audit_log where id = $1', [id])
      expect(record.rows).toHaveLength(1)
      expect(record.rows[0]).toMatchObject({
        actor_profile_id: profileIds.alice,
        action: 'test.demo_action',
        resource_type: 'restaurant',
        resource_id: restaurantIds.blueOlive,
        reason: 'demonstration reason',
        restaurant_id: restaurantIds.blueOlive,
        branch_id: branchIds.downtown,
      })
      expect(record.rows[0].created_at).toBeTruthy()
    })
  }, 20000)

  it('accepts a missing reason (single optional field per FR-012)', async () => {
    await inTransaction(client, async () => {
      const { rows } = await client.query(
        'select private.record_audit($1, $2, $3, $4, $5, $6, $7) as id',
        auditCall(
          profileIds.bob,
          'test.no_reason',
          'branch',
          branchIds.downtown,
          null,
          restaurantIds.blueOlive,
          null,
        ),
      )
      expect(rows[0].id).toBeTruthy()
    })
  })

  it('rejects writes with missing required context, naming the field', async () => {
    await inTransaction(client, async () => {
      await expectAuditValidationError(
        auditCall(null, 'a', 'rt', 'ri', null, restaurantIds.blueOlive, null),
        'actor',
      )
      await expectAuditValidationError(
        auditCall(profileIds.alice, null, 'rt', 'ri', null, restaurantIds.blueOlive, null),
        'action',
      )
      await expectAuditValidationError(
        auditCall(profileIds.alice, '   ', 'rt', 'ri', null, restaurantIds.blueOlive, null),
        'action',
      )
      await expectAuditValidationError(
        auditCall(profileIds.alice, 'a', null, 'ri', null, restaurantIds.blueOlive, null),
        'resource type',
      )
      await expectAuditValidationError(
        auditCall(profileIds.alice, 'a', '  ', 'ri', null, restaurantIds.blueOlive, null),
        'resource type',
      )
      await expectAuditValidationError(
        auditCall(profileIds.alice, 'a', 'rt', null, null, restaurantIds.blueOlive, null),
        'resource id',
      )
      await expectAuditValidationError(
        auditCall(profileIds.alice, 'a', 'rt', 'ri', null, null, null),
        'tenant scope',
      )
    })
  }, 30000)

  it('rejects a branch that belongs to another restaurant (composite FK)', async () => {
    await inTransaction(client, async () => {
      await expectStatementToFail(
        client,
        '23503',
        'select private.record_audit($1, $2, $3, $4, $5, $6, $7)',
        auditCall(
          profileIds.alice,
          'a',
          'rt',
          'ri',
          null,
          restaurantIds.blueOlive,
          branchIds.airport,
        ),
      )
    })
  })
})

describe('append-only posture: no client-accessible path (FR-013, SC-004)', () => {
  it('authenticated staff cannot read, write, or execute the audit writer', async () => {
    await asUser(client, authUserIds.alice, async () => {
      await expectStatementToFail(client, '42501', 'select * from public.audit_log')
      await expectStatementToFail(
        client,
        '42501',
        `insert into public.audit_log
             (actor_profile_id, action, resource_type, resource_id, restaurant_id)
           values ('${profileIds.alice}', 'x', 'y', 'z', '${restaurantIds.blueOlive}')`,
      )
      await expectStatementToFail(client, '42501', 'update public.audit_log set action = $1', [
        'tampered',
      ])
      await expectStatementToFail(client, '42501', 'delete from public.audit_log')
      await expectStatementToFail(
        client,
        '42501',
        `select private.record_audit(
             '${profileIds.alice}', 'x', 'y', 'z', null, '${restaurantIds.blueOlive}', null)`,
      )
    })
  }, 30000)

  it('anon cannot read the audit store or execute the audit writer', async () => {
    await asAnon(client, async () => {
      await expectStatementToFail(client, '42501', 'select * from public.audit_log')
      await expectStatementToFail(
        client,
        '42501',
        `select private.record_audit(
           '${profileIds.alice}', 'x', 'y', 'z', null, '${restaurantIds.blueOlive}', null)`,
      )
    })
  })
})
