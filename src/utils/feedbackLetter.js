// Builds the monthly "Feedback Letter & List" (.docx) for a batch —
// candidate names with a "Feedback Submitted" column that's always "Yes"
// (fixed, not pulled from any real feedback-tracking data — there isn't
// one yet), addressed the same way as the Commencement Letter.
const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, AlignmentType, WidthType, BorderStyle, VerticalAlign } = require('docx');

const CELL_BORDER = { style: BorderStyle.SINGLE, size: 2, color: '000000' };
const ALL_BORDERS = { top: CELL_BORDER, bottom: CELL_BORDER, left: CELL_BORDER, right: CELL_BORDER };

function cell(text, { bold = false, widthPct, align } = {}) {
  return new TableCell({
    width: widthPct ? { size: widthPct, type: WidthType.PERCENTAGE } : undefined,
    borders: ALL_BORDERS,
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 80, bottom: 80, left: 100, right: 100 },
    children: [new Paragraph({ alignment: align, children: [new TextRun({ text: String(text == null ? '' : text), bold })] })],
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

// enrollments: active Enrollment rows for this batch, each with `student`.
// coordinator: { name, email } or null. monthLabel: free text, e.g. "Mar-Apr-26".
function buildFeedbackLetter(batch, enrollments, coordinator, monthLabel) {
  const course = batch.course;
  const center = batch.trainingCenter;
  const scheme = resolveScheme(batch);

  const tcLine = center ? `${center.name || ''} ${center.address || ''}`.trim() : '';

  const headerRow = new TableRow({
    children: [
      cell('Sr.\nNo.', { bold: true, widthPct: 10, align: AlignmentType.CENTER }),
      cell('Name of Candidates', { bold: true, widthPct: 60 }),
      cell('Feedback Submitted (Yes/No)', { bold: true, widthPct: 30, align: AlignmentType.CENTER }),
    ],
  });

  const rows = enrollments.map((e, idx) => new TableRow({
    children: [
      cell(idx + 1, { widthPct: 10, align: AlignmentType.CENTER }),
      cell(e.student.full_name || e.student.name, { widthPct: 60 }),
      cell('Yes', { widthPct: 30, align: AlignmentType.CENTER }),
    ],
  }));

  const children = [
    para('विद्यार्थ्यांचे महिनानिहाय प्रशिक्षणाबाबत प्रतिसाद पत्र व यादी', { align: AlignmentType.CENTER, bold: true, size: 26, after: 60 }),
    para('(Monthly Training Feedback Letter and List)', { align: AlignmentType.CENTER, bold: true, size: 22, after: 240 }),

    para('To,', { after: 0 }),
    para('Managing Director,', { bold: true, after: 0 }),
    para((scheme && scheme.report_heading) || '', { bold: true, after: 240 }),

    para(`Name of Course: ${course ? course.name : ''}`, { after: 60 }),
    para(`Name and address of Training Centre: ${tcLine}`, { after: 60 }),
    para(`Month Of Feedback: ${monthLabel || ''}          Batch Number: ${batch.report_batch_number || ''}`, { after: 240 }),

    new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [headerRow, ...rows] }),

    para('', { after: 360 }),
    para(`Name: For on behalf of ${coordinator ? coordinator.name : ''} (Project Incharge)`, { align: AlignmentType.RIGHT, after: 120 }),
    para('Signature:', { align: AlignmentType.RIGHT, after: 0 }),
    para('Stamp of TSP:', { align: AlignmentType.RIGHT, after: 0 }),
  ];

  const doc = new Document({ sections: [{ children }] });
  return Packer.toBuffer(doc);
}

module.exports = { buildFeedbackLetter };
