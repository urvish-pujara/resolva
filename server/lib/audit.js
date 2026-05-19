import { v4 as uuid } from 'uuid';
import { query, nowSql } from '../db.js';

const SQL = `
  INSERT INTO audit_log (id, actor_type, actor_id, event_type, target_type, target_id, metadata_json, created_at)
  VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
`;

export async function writeAudit(
  { actor_type, actor_id, event_type, target_type, target_id, metadata, created_at = null },
  client,
) {
  const exec = client ? client.query.bind(client) : query;
  await exec(SQL, [
    uuid(),
    actor_type,
    actor_id || null,
    event_type,
    target_type,
    target_id,
    metadata ? JSON.stringify(metadata) : null,
    created_at || nowSql(),
  ]);
}
