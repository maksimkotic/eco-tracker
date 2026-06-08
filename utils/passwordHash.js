const crypto = require('crypto');

const DEFAULT_ITERATIONS = 100000;
const KEY_LENGTH = 64;
const DIGEST = 'sha256';
const PREFIX = 'pbkdf2';

const resolveIterations = (value) => {
  const cost = Number(value);
  if (!Number.isFinite(cost) || cost <= 0) {
    return DEFAULT_ITERATIONS;
  }

  if (cost < 1000) {
    return Math.max(1, Math.round(cost * 10000));
  }

  return Math.max(1, Math.round(cost));
};

const generateSalt = () => crypto.randomBytes(16).toString('hex');

const parseHash = (value) => {
  if (typeof value !== 'string') {
    return null;
  }

  const parts = value.split('$');
  if (parts.length !== 4 || parts[0] !== PREFIX) {
    return null;
  }

  const iterations = Number(parts[1]);
  if (!Number.isFinite(iterations) || iterations <= 0) {
    return null;
  }

  return {
    iterations,
    salt: parts[2],
    hash: parts[3],
  };
};

const pbkdf2Async = (password, salt, iterations) =>
  new Promise((resolve, reject) => {
    crypto.pbkdf2(password, salt, iterations, KEY_LENGTH, DIGEST, (error, derivedKey) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(derivedKey.toString('hex'));
    });
  });

const genSalt = async (rounds = 10) => {
  const iterations = resolveIterations(rounds);
  return `${PREFIX}$${iterations}$${generateSalt()}`;
};

const hash = async (password, saltOrRounds = 10) => {
  const parsedSalt = parseHash(saltOrRounds);
  const saltData = parsedSalt || {
    iterations: resolveIterations(saltOrRounds),
    salt: generateSalt(),
  };

  const derived = await pbkdf2Async(String(password ?? ''), saltData.salt, saltData.iterations);
  return `${PREFIX}$${saltData.iterations}$${saltData.salt}$${derived}`;
};

const compare = async (password, storedHash) => {
  const parsed = parseHash(storedHash);
  if (!parsed) {
    return false;
  }

  const derived = await pbkdf2Async(String(password ?? ''), parsed.salt, parsed.iterations);
  const derivedBuffer = Buffer.from(derived, 'hex');
  const storedBuffer = Buffer.from(parsed.hash, 'hex');

  if (derivedBuffer.length !== storedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(derivedBuffer, storedBuffer);
};

module.exports = {
  compare,
  genSalt,
  hash,
};
