/**
 * @file src/exporters/docxExporter.js
 * @description Exports worksheet and answer key as Word (.docx) documents
 * @agent DEV
 */

import {
  Document,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
  Packer,
} from 'docx';
import { writeFileSync } from 'fs';
import { buildOutputPath } from '../utils/fileUtils.js';

// US Letter in DXA: width=12240 (8.5"), height=15840 (11"), margins=1440 (1")
const PAGE_SETTINGS = {
  page: {
    size: { width: 12240, height: 15840 },
    margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
  },
};

/**
 * Formats YYYY-MM-DD date into MM/DD/YYYY for worksheet headers.
 * @param {string} value
 * @returns {string}
 */
function formatHeaderDate(value) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return '';
  }
  const [year, month, day] = value.split('-');
  return `${month}/${day}/${year}`;
}

/**
 * Builds Paragraph nodes for a single question
 * @param {Object} q - Question object
 * @returns {Paragraph[]} Array of docx Paragraph objects
 */
function buildQuestionParagraphs(q) {
  const paras = [
    new Paragraph({
      children: [
        new TextRun({ text: `${q.number}. `, bold: true, font: 'Arial', size: 24 }),
        new TextRun({ text: q.question, font: 'Arial', size: 24 }),
        new TextRun({ text: `  (${q.points} pt${q.points !== 1 ? 's' : ''})`, font: 'Arial', size: 18, color: '666666' }),
      ],
      spacing: { before: 200 },
    }),
  ];

  if (q.type === 'multiple-choice' && Array.isArray(q.options)) {
    q.options.forEach((opt) => {
      paras.push(
        new Paragraph({
          children: [new TextRun({ text: `    ${opt}`, font: 'Arial', size: 22 })],
          spacing: { before: 80 },
        })
      );
    });
  } else if (q.type === 'true-false') {
    paras.push(
      new Paragraph({
        children: [new TextRun({ text: '    ○ True     ○ False', font: 'Arial', size: 22 })],
        spacing: { before: 80 },
      })
    );
  } else if (q.type === 'show-your-work') {
    paras.push(
      new Paragraph({
        children: [new TextRun({ text: '    Work area:', font: 'Arial', size: 22, italics: true, color: '888888' })],
        spacing: { before: 80 },
      }),
      new Paragraph({ children: [new TextRun({ text: '' })], spacing: { before: 300 } })
    );
  } else {
    // fill-in-the-blank, short-answer, word-problem, matching
    paras.push(
      new Paragraph({
        children: [new TextRun({ text: '    Answer: ___________________________', font: 'Arial', size: 22 })],
        spacing: { before: 80 },
      })
    );
  }

  return paras;
}

/**
 * Exports the worksheet as a .docx file
 * @param {Object} worksheet - Parsed worksheet JSON
 * @param {Object} options - Export options (outputDir, studentName, etc.)
 * @returns {Promise<string>} Path to the generated .docx file
 */
export async function exportDOCX(worksheet, options) {
  const studentName = options.studentName || '';
  const worksheetDate = formatHeaderDate(options.worksheetDate || '');
  const teacherName = options.teacherName || '';
  const period = options.period || '';
  const className = options.className || '';

  const doc = new Document({
    ...PAGE_SETTINGS,
    sections: [
      {
        properties: PAGE_SETTINGS,
        children: [
          new Paragraph({
            text: worksheet.title,
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER,
          }),
          new Paragraph({
            children: [
              new TextRun({ text: `Grade ${worksheet.grade}  ·  ${worksheet.subject}  ·  ${worksheet.difficulty}`, font: 'Arial', size: 20, color: '555555' }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: `Name: ${studentName}_______________________   Date: ${worksheetDate}_____________________   Score: _______ / ${worksheet.totalPoints}`, font: 'Arial', size: 22 }),
            ],
            border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '000000' } },
            spacing: { after: 140 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: `Teacher: ${teacherName}_______________________   Period: ${period}_______________________   Class: ${className}`, font: 'Arial', size: 22 }),
            ],
            border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '000000' } },
            spacing: { after: 200 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: `Instructions: ${worksheet.instructions}`, font: 'Arial', size: 22, italics: true }),
            ],
            spacing: { after: 240 },
          }),
          new Paragraph({ text: 'Questions', heading: HeadingLevel.HEADING_2 }),
          ...worksheet.questions.flatMap(buildQuestionParagraphs),
          new Paragraph({
            children: [
              new TextRun({ text: `EduSheet AI — Generated ${new Date().toLocaleDateString('en-US')} — © ${new Date().getFullYear()} — For Educational Use`, font: 'Arial', size: 16, color: '888888' }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { before: 400 },
          }),
        ],
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  const outputPath = buildOutputPath(options.outputDir, options, 'docx');
  writeFileSync(outputPath, buffer);
  return outputPath;
}

/**
 * Exports the answer key as a .docx file
 * @param {Object} worksheet - Parsed worksheet JSON
 * @param {Object} options - Export options
 * @returns {Promise<string>} Path to the generated answer key .docx file
 */
export async function exportAnswerKeyDOCX(worksheet, options) {
  const answerParagraphs = worksheet.questions.flatMap((q) => [
    new Paragraph({
      children: [
        new TextRun({ text: `${q.number}. `, bold: true, font: 'Arial', size: 24 }),
        new TextRun({ text: `Answer: `, font: 'Arial', size: 24 }),
        new TextRun({ text: String(q.answer), bold: true, color: '006600', font: 'Arial', size: 24 }),
        new TextRun({ text: q.explanation ? `  — ${q.explanation}` : '', font: 'Arial', size: 20, color: '555555' }),
      ],
      spacing: { before: 160, after: 80 },
    }),
  ]);

  const doc = new Document({
    ...PAGE_SETTINGS,
    sections: [
      {
        properties: PAGE_SETTINGS,
        children: [
          new Paragraph({
            text: 'ANSWER KEY — Teacher Copy',
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER,
          }),
          new Paragraph({
            children: [new TextRun({ text: worksheet.title, font: 'Arial', size: 22, color: '444444' })],
            alignment: AlignmentType.CENTER,
            spacing: { after: 300 },
          }),
          ...answerParagraphs,
        ],
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  const outputPath = buildOutputPath(options.outputDir, options, 'docx', 'ANSWER_KEY');
  writeFileSync(outputPath, buffer);
  return outputPath;
}
