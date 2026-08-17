const { Op } = require('sequelize');
const { Batch } = require('../models');

function buildPrefix(course) {
  return (
    course.name
      .toUpperCase()
      .replace(/[^A-Z ]/g, '')
      .split(' ')
      .filter(Boolean)
      .map((word) => word[0])
      .join('')
      .slice(0, 4) || 'GEN'
  );
}

// Letter+number pairs run A1..A9, B1..B9, ... — encode/decode that as a
// single 0-based sequence index so "next" and "highest used" are simple
// integer math.
function indexToSuffix(index) {
  const letter = String.fromCharCode(65 + Math.floor(index / 9));
  const number = (index % 9) + 1;
  return `${letter}${number}`;
}

function suffixToIndex(letter, number) {
  return (letter.charCodeAt(0) - 65) * 9 + (Number(number) - 1);
}

// Was previously derived from Batch.count({ where: { course_id } }) — a
// COUNT-based scheme silently produces a code that already exists as soon
// as a batch anywhere in that course's history gets deleted (the count
// drops, but the codes it skips over are already taken), or when two
// batches for the same course are created at nearly the same moment (both
// read the same count before either insert lands). Both were hit in
// production as a crashed, unhandled "duplicate key value violates
// unique constraint batches_batch_code_key" — this is deliberately based
// on the highest suffix actually on file, and the retry loop in
// generateUniqueBatchCode below is the real backstop against the
// concurrent-request case, which no amount of pre-checking can fully rule
// out on its own.
async function generateBatchCode(course, startDate) {
  const prefix = buildPrefix(course);
  const year = new Date(startDate).getFullYear();
  const codePattern = new RegExp(`^${prefix}-${year}-([A-Z])(\\d)$`);

  const existing = await Batch.findAll({
    where: { course_id: course.id, batch_code: { [Op.like]: `${prefix}-${year}-%` } },
    attributes: ['batch_code'],
  });

  let maxIndex = -1;
  existing.forEach((b) => {
    const m = b.batch_code && b.batch_code.match(codePattern);
    if (m) maxIndex = Math.max(maxIndex, suffixToIndex(m[1], m[2]));
  });

  return `${prefix}-${year}-${indexToSuffix(maxIndex + 1)}`;
}

// Wraps generateBatchCode with a create-and-retry loop so a genuine race
// between two near-simultaneous requests for the same course (both read
// the same "highest used" suffix before either insert lands) still can't
// crash the request — the DB's own unique constraint is the real
// tie-breaker; this just means the loser tries the next code instead of
// throwing. `createFn` receives the generated code and must actually
// perform the insert (so this can wrap Batch.create with whatever other
// fields the caller needs); it should let a duplicate-batch_code error
// propagate so this loop can catch it and retry.
async function generateUniqueBatchCode(course, startDate, createFn, attempts = 5) {
  for (let i = 0; i < attempts; i++) {
    const batch_code = await generateBatchCode(course, startDate);
    try {
      return await createFn(batch_code);
    } catch (err) {
      const isDuplicateBatchCode =
        err.name === 'SequelizeUniqueConstraintError' && err.fields && Object.prototype.hasOwnProperty.call(err.fields, 'batch_code');
      if (!isDuplicateBatchCode || i === attempts - 1) throw err;
    }
  }
  throw new Error('Could not generate a unique batch code after several attempts');
}

module.exports = { generateBatchCode, generateUniqueBatchCode };
