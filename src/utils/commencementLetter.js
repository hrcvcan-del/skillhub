// Builds the "Course Commencement Letter" (.docx) for a batch, addressed to
// the scheme's Managing Director. Course/batch details and the enrolled
// candidates' category/gender/PwD breakdown are pulled live from the ERP at
// generation time — nothing here is typed in by hand.
const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  AlignmentType,
  WidthType,
  BorderStyle,
  VerticalAlign,
} = require('docx');
const { toDDMMYYYY } = require('./reportDate');

const CELL_BORDER = { style: BorderStyle.SINGLE, size: 2, color: '000000' };
const ALL_BORDERS = { top: CELL_BORDER, bottom: CELL_BORDER, left: CELL_BORDER, right: CELL_BORDER };

function cell(text, { bold = false, widthPct, align } = {}) {
  return new TableCell({
    width: widthPct ? { size: widthPct, type: WidthType.PERCENTAGE } : undefined,
    borders: ALL_BORDERS,
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 80, bottom: 80, left: 100, right: 100 },
    children: [
      new Paragraph({
        alignment: align,
        children: [new TextRun({ text: String(text == null ? '' : text), bold })],
      }),
    ],
  });
}

function twoColTable(pairs) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: pairs.map(([label, value]) => new TableRow({
      children: [cell(label, { bold: true, widthPct: 45 }), cell(value, { widthPct: 55 })],
    })),
  });
}

// Groups a raw caste-category string into the report column it belongs
// under. NT-B/NT-C/NT-D are combined into a single "NT (B, C, D)" column to
// match the government template; every other category gets its own column
// labeled with whatever the admin actually entered.
function categoryGroup(rawCategory) {
  const c = String(rawCategory || '').trim().toUpperCase();
  if (!c) return 'Unspecified';
  if (c.startsWith('NT')) return 'NT (B, C, D)';
  return rawCategory.trim();
}

function buildCategoryBreakdown(students) {
  const columns = [];
  const counts = {}; // { [column]: { male, female, pwd, total } }

  students.forEach((s) => {
    const col = categoryGroup(s.caste_category);
    if (!columns.includes(col)) columns.push(col);
    if (!counts[col]) counts[col] = { male: 0, female: 0, pwd: 0, total: 0 };
    const bucket = counts[col];
    const gender = String(s.gender || '').trim().toLowerCase();
    if (gender === 'male') bucket.male += 1;
    else if (gender === 'female') bucket.female += 1;
    bucket.total += 1;
    if (String(s.pwd || '').trim().toUpperCase() === 'YES') bucket.pwd += 1;
  });

  return { columns, counts };
}

function categoryTable(students) {
  const { columns, counts } = buildCategoryBreakdown(students);
  const cols = columns.length > 0 ? columns : ['-'];
  const headerWidth = 100 / (cols.length + 1);

  const headerRow = new TableRow({
    children: [
      cell('Category', { bold: true, widthPct: headerWidth }),
      ...cols.map((c) => cell(c, { bold: true, widthPct: headerWidth, align: AlignmentType.CENTER })),
    ],
  });

  const rowFor = (label, key) => new TableRow({
    children: [
      cell(label, { bold: true, widthPct: headerWidth }),
      ...cols.map((c) => cell(counts[c] ? counts[c][key] : 0, { widthPct: headerWidth, align: AlignmentType.CENTER })),
    ],
  });

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [headerRow, rowFor('Male', 'male'), rowFor('Female', 'female'), rowFor('PwD', 'pwd'), rowFor('Total', 'total')],
  });
}

function para(text, opts = {}) {
  return new Paragraph({
    alignment: opts.align,
    spacing: { after: opts.after != null ? opts.after : 120 },
    children: [new TextRun({ text, bold: !!opts.bold, size: opts.size })],
  });
}

function resolveScheme(batch) {
  return batch.trainingCenter && batch.trainingCenter.schemePhase && batch.trainingCenter.schemePhase.scheme;
}

function formatTimings(batch) {
  if (!batch.start_time || !batch.end_time) return '';
  return `${batch.start_time} TO ${batch.end_time}`;
}

// enrollments: active Enrollment rows for this batch, each with `student`
// included. coordinator: { name, email } or null.
function buildCommencementLetter(batch, enrollments, coordinator) {
  const course = batch.course;
  const center = batch.trainingCenter;
  const scheme = resolveScheme(batch);
  const students = enrollments.map((e) => e.student);

  const coordinatorText = coordinator ? `${coordinator.name},\nEmail: ${coordinator.email}` : '';

  const children = [
    para('प्रशिक्षण सुरु केल्याचे पत्र', { align: AlignmentType.CENTER, bold: true, size: 28, after: 40 }),
    para('(Course Commencement Letter)', { align: AlignmentType.CENTER, bold: true, size: 24, after: 240 }),

    para('To,', { after: 0 }),
    para('Managing Director,', { bold: true, after: 0 }),
    para((scheme && scheme.report_heading) || '', { bold: true, after: 240 }),

    para('Respected Sir / Madam,', { after: 240 }),

    para(
      `We ${course && course.sector_skill_council ? course.sector_skill_council : ''} will commence the following course from ${toDDMMYYYY(batch.start_date)}`,
      { after: 120 }
    ),

    twoColTable([
      ['Name of the Course', course ? course.name : ''],
      ['Location (District)', center ? center.district || '' : ''],
      ['Address of Training Center', center ? center.address || '' : ''],
      ['Name and Email ID of Coordinator', coordinatorText],
    ]),

    para('', { after: 120 }),
    para('The Course and Batch details are as follows:', { after: 120 }),

    twoColTable([
      ['Total Duration of the Course (in hours)', course ? course.duration_hours || '' : ''],
      ['Batch Number', batch.report_batch_number || ''],
      ['Training Hours per day (in hours)', course ? course.training_hours_per_day || '' : ''],
      ['Days of Lodging and Boarding', course ? course.lodging_boarding || '' : ''],
      ['Timings of the batch', formatTimings(batch)],
      ['Weekly holiday for the batch', batch.weekly_holiday || ''],
      ['Start Date of the batch', toDDMMYYYY(batch.start_date)],
      ['End date of the batch', toDDMMYYYY(batch.end_date)],
      ['Sanctioned Batch Size', batch.sanctioned_batch_size || ''],
      ['Actual number of trainees enrolled', String(enrollments.length)],
    ]),

    para('', { after: 120 }),
    categoryTable(students),

    para('', { after: 360 }),
    para('Thanking you,', { align: AlignmentType.RIGHT, after: 240 }),
    para(`Name: For on behalf of ${coordinator ? coordinator.name : ''}`, { align: AlignmentType.RIGHT, after: 0 }),
    para('(Project Incharge)', { align: AlignmentType.RIGHT, after: 120 }),
    para('Signature:', { align: AlignmentType.RIGHT, after: 0 }),
    para('Stamp of TSP:', { align: AlignmentType.RIGHT, after: 0 }),
  ];

  const doc = new Document({
    sections: [{ children }],
  });

  return Packer.toBuffer(doc);
}

module.exports = { buildCommencementLetter };
