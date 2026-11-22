const lockKey = '{csee-schedule}:editor';
const scheduleKey = '{csee-schedule}:deadlines';

const sharedSchedule = Boolean(process.env.UPSTASH_REDIS_REST_URL || process.env.UPSTASH_REDIS_REST_TOKEN);

async function redis(...command) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new Error('Shared schedule storage is not configured.');
  const response = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(command),
    signal: AbortSignal.timeout(5000)
  });
  const data = await response.json();
  if (!response.ok || data.error) throw new Error('Shared schedule storage is unavailable.');
  return data.result;
}

const updateLock = `
  if redis.call('GET', KEYS[1]) ~= ARGV[1] then return 0 end
  if ARGV[2] == 'release' then return redis.call('DEL', KEYS[1]) end
  return redis.call('EXPIRE', KEYS[1], ARGV[2])
`;

const saveSchedule = `
  if redis.call('GET', KEYS[1]) ~= ARGV[1] then return 'expired' end
  local version = redis.call('HGET', KEYS[2], 'version') or 'initial'
  if version ~= ARGV[2] then return 'conflict' end
  redis.call('HSET', KEYS[2], 'version', ARGV[3], 'items', ARGV[4])
  return 'saved'
`;

module.exports = {
  sharedSchedule,
  acquireEditor: (id, seconds) => redis('SET', lockKey, id, 'NX', 'EX', seconds),
  ownsEditor: async id => (await redis('GET', lockKey)) === id,
  renewEditor: (id, seconds) => redis('EVAL', updateLock, 1, lockKey, id, seconds),
  releaseEditor: id => redis('EVAL', updateLock, 1, lockKey, id, 'release'),
  readSharedSchedule: () => redis('HMGET', scheduleKey, 'version', 'items'),
  writeSharedSchedule: (id, expected, version, items) =>
    redis('EVAL', saveSchedule, 2, lockKey, scheduleKey, id, expected, version, JSON.stringify(items))
};
