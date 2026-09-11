import { NextRequest, NextResponse } from 'next/server';
import { getActiveContext } from '@/lib/queries';
import { getQuiz, getQuizQuestions } from '@/lib/actions/quiz';
import {
  Document, Paragraph, TextRun, Table, TableRow, TableCell,
  WidthType, BorderStyle, AlignmentType, HeadingLevel, Packer,
  ShadingType, PageBreak,
} from 'docx';

const OPTION_LETTERS = ['A', 'B', 'C', 'D'];
const LEVEL_NO: Record<string, string> = { lett: 'Lett', middels: 'Middels', vanskelig: 'Vanskelig' };

function borderNone() {
  const s = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
  return { top: s, bottom: s, left: s, right: s, insideHorizontal: s, insideVertical: s };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const ctx = await getActiveContext();
  if (!ctx) return new NextResponse('Ikke innlogget', { status: 401 });

  const [quiz, questions] = await Promise.all([
    getQuiz(params.id),
    getQuizQuestions(params.id),
  ]);

  if (!quiz || questions.length === 0) {
    return new NextResponse('Ikke funnet', { status: 404 });
  }

  const children: (Paragraph | Table)[] = [];

  // ── Title ────────────────────────────────────────────────────────────────
  children.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      children: [new TextRun({ text: quiz.topic, bold: true, size: 36, color: '1c648e' })],
      spacing: { after: 120 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: `Fag: ${quiz.subject}   |   Nivå: ${LEVEL_NO[quiz.level] ?? quiz.level}   |   ${questions.length} spørsmål`, size: 20, color: '71787f' }),
      ],
      spacing: { after: 400 },
    }),
    new Paragraph({
      children: [new TextRun({ text: 'Navn: ____________________________________   Dato: ________________', size: 22 })],
      spacing: { after: 480 },
    })
  );

  // ── Questions ─────────────────────────────────────────────────────────────
  questions.forEach((q, qi) => {
    // Question text
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: `${qi + 1}.  `, bold: true, size: 24, color: '1c648e' }),
          new TextRun({ text: q.question_text, bold: true, size: 24 }),
        ],
        spacing: { before: qi === 0 ? 0 : 320, after: 160 },
      })
    );

    // Options as table (2 columns)
    const half = Math.ceil(q.options.length / 2);
    const rows: TableRow[] = [];
    for (let r = 0; r < half; r++) {
      const cells: TableCell[] = [];
      for (let c = 0; c < 2; c++) {
        const idx = r + c * half;
        const opt = q.options[idx];
        cells.push(
          new TableCell({
            borders: borderNone(),
            width: { size: 50, type: WidthType.PERCENTAGE },
            children: opt
              ? [new Paragraph({
                  children: [
                    new TextRun({ text: `○  ${OPTION_LETTERS[idx]}.  `, bold: true, size: 22, color: '41484e' }),
                    new TextRun({ text: opt.text, size: 22 }),
                  ],
                  spacing: { after: 100 },
                })]
              : [new Paragraph({ children: [] })],
          })
        );
      }
      rows.push(new TableRow({ children: cells }));
    }
    children.push(
      new Table({
        rows,
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: borderNone(),
      })
    );
  });

  // ── Page break before answer key ─────────────────────────────────────────
  children.push(
    new Paragraph({
      children: [new PageBreak()],
    }),
    new Paragraph({
      heading: HeadingLevel.HEADING_2,
      children: [new TextRun({ text: 'FASIT', bold: true, size: 28, color: '1c648e' })],
      spacing: { after: 240 },
    }),
    new Paragraph({
      children: [new TextRun({ text: `${quiz.topic} — ${LEVEL_NO[quiz.level] ?? quiz.level}`, size: 20, color: '71787f' })],
      spacing: { after: 320 },
    })
  );

  // Answer key table
  const cols = 4;
  const keyRows: TableRow[] = [];
  for (let r = 0; r < Math.ceil(questions.length / cols); r++) {
    const cells: TableCell[] = [];
    for (let c = 0; c < cols; c++) {
      const qi = r * cols + c;
      const q = questions[qi];
      const correctIdx = q ? q.options.findIndex(o => o.is_correct) : -1;
      cells.push(
        new TableCell({
          borders: borderNone(),
          width: { size: 25, type: WidthType.PERCENTAGE },
          shading: qi < questions.length ? { type: ShadingType.SOLID, color: 'ebf5ff' } : undefined,
          children: q ? [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({ text: `${qi + 1}. `, size: 22, bold: true, color: '71787f' }),
                new TextRun({ text: OPTION_LETTERS[correctIdx] ?? '?', size: 22, bold: true, color: '1c648e' }),
              ],
              spacing: { before: 80, after: 80 },
            })
          ] : [new Paragraph({ children: [] })],
        })
      );
    }
    keyRows.push(new TableRow({ children: cells }));
  }
  children.push(new Table({ rows: keyRows, width: { size: 80, type: WidthType.PERCENTAGE }, borders: borderNone() }));

  // Explanations
  if (questions.some(q => q.explanation)) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: 'Forklaringer', bold: true, size: 24, color: '1c648e' })],
        spacing: { before: 400, after: 200 },
      })
    );
    questions.forEach((q, qi) => {
      if (!q.explanation) return;
      const correctIdx = q.options.findIndex(o => o.is_correct);
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: `${qi + 1}. (${OPTION_LETTERS[correctIdx]}) `, bold: true, size: 20, color: '1c648e' }),
            new TextRun({ text: q.explanation, size: 20, italics: true }),
          ],
          spacing: { after: 120 },
        })
      );
    });
  }

  // ── Generate ──────────────────────────────────────────────────────────────
  const doc = new Document({
    styles: {
      default: { document: { run: { font: 'Calibri' } } },
    },
    sections: [{
      properties: {
        page: {
          margin: { top: 1080, bottom: 1080, left: 1080, right: 1080 },
        },
      },
      children,
    }],
  });

  const buffer = await Packer.toBuffer(doc);
  const filename = `quiz-${quiz.topic.replace(/[^a-zA-Z0-9æøåÆØÅ\s]/g, '').trim().replace(/\s+/g, '-')}.docx`;

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
