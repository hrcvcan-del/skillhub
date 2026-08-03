const { Batch } = require('../models');

async function generateBatchCode(course, startDate) {
  const prefix = course.name
    .toUpperCase()
    .replace(/[^A-Z ]/g, '')
    .split(' ')
    .filter(Boolean)
    .map((word) => word[0])
    .join('')
    .slice(0, 4) || 'GEN';

  const year = new Date(startDate).getFullYear();
  const existingCount = await Batch.count({ where: { course_id: course.id } });
  const letter = String.fromCharCode(65 + Math.floor(existingCount / 9));
  const number = (existingCount % 9) + 1;

  return `${prefix}-${year}-${letter}${number}`;
}

module.exports = { generateBatchCode };
