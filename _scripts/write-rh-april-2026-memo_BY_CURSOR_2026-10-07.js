#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const {
  Document, Packer, Paragraph, TextRun, Header, Footer,
  AlignmentType, BorderStyle, PageNumber, LevelFormat
} = require('docx');

const NAVY = '0A1F3D';
const GOLD = 'C8A97E';
const BODY = '1A1A1A';
const MUTED = '5C6B80';

function p(opts) {
  return new Paragraph(opts);
}
function run(text, extra) {
  return new TextRun(Object.assign({
    text: text,
    font: 'Calibri',
    size: 22,
    color: BODY
  }, extra || {}));
}

const children = [
  p({
    spacing: { after: 80 },
    children: [new TextRun({ text: 'CCH DESIGN', font: 'Georgia', size: 36, bold: true, color: NAVY, characterSpacing: 240 })]
  }),
  p({
    spacing: { after: 240 },
    border: { bottom: { color: GOLD, space: 1, size: 12, style: BorderStyle.SINGLE } },
    children: [new TextRun({ text: 'Everything from us should look like a gift.', font: 'Georgia', italics: true, size: 18, color: GOLD })]
  }),
  p({
    spacing: { before: 200, after: 80 },
    children: [new TextRun({ text: 'APRIL 2026  ·  PROJECT UPDATE', font: 'Calibri', size: 20, bold: true, color: GOLD, characterSpacing: 160 })]
  }),
  p({
    spacing: { after: 80 },
    children: [new TextRun({ text: 'Cloud — Rolling Hills', font: 'Georgia', size: 40, bold: true, color: NAVY })]
  }),
  p({
    spacing: { after: 40 },
    children: [run('Prepared for Tracey Cloud', { size: 22, color: MUTED })]
  }),
  p({
    spacing: { after: 40 },
    children: [run('87 Haslin Ranch Road, Rolling Hills, California', { size: 20, color: MUTED })]
  }),
  p({
    spacing: { after: 320 },
    children: [run('Invoice INV-6079  ·  Design services  ·  April 1–30, 2026', { size: 20, color: MUTED })]
  }),

  p({
    spacing: { after: 200 },
    children: [run('This note accompanies INV-6079 and describes the design work completed in April — including time that was given, not billed. It is a record of progress on the house: lighting, cabinets, fireplaces, outdoor living, and the boards and drawings that keep the project aligned.')]
  }),

  p({
    spacing: { before: 80, after: 120 },
    children: [new TextRun({ text: 'The month in brief', font: 'Georgia', size: 26, bold: true, color: NAVY })]
  }),
  p({
    spacing: { after: 200 },
    children: [run('April was a lighting-and-finish month. We built and revised the lighting schedule and specifications, updated room boards as selections changed, met with you on fireplaces and lighting, then carried those decisions into Suite 3, the model, and new renderings. In parallel we advanced outdoor living — BBQ, bar, landscape, and pool house — walked the job with cabinet finishes, and closed the month on master-bath windows. Four and a half hours of lighting-schedule and proposal work this month were completed and not charged.')]
  }),

  p({
    spacing: { before: 80, after: 120 },
    children: [new TextRun({ text: 'Work included at no charge', font: 'Georgia', size: 26, bold: true, color: NAVY })]
  }),
  p({
    spacing: { after: 160 },
    children: [run('Not every hour on a project like this belongs on an invoice. In April, 4.5 hours of lighting schedules and proposals were recorded as complimentary — $0 on INV-6079 — so you can see the work and know it was not billed.')]
  }),
  p({
    numbering: { reference: 'bullets', level: 0 },
    spacing: { after: 80 },
    children: [run('April 9 — 2.25 hours — lighting schedule and proposals, after our call on fireplaces and lighting. Not billed.')]
  }),
  p({
    numbering: { reference: 'bullets', level: 0 },
    spacing: { after: 160 },
    children: [run('April 14 — 2.25 hours — lighting schedules and proposals, alongside the billed specification work that same day. Not billed.')]
  }),
  p({
    spacing: { after: 200 },
    children: [new TextRun({ text: 'These hours appear on the invoice as a Non-Billable line at $0.00 so the gift is visible, not hidden.', font: 'Calibri', size: 22, italics: true, color: MUTED })]
  }),

  p({
    spacing: { before: 80, after: 120 },
    children: [new TextRun({ text: 'Lighting program', font: 'Georgia', size: 26, bold: true, color: NAVY })]
  }),
  p({
    spacing: { after: 160 },
    children: [run('The largest block of April time went to the lighting program: schedules, specifications, proposals, and room-board updates. Exterior lighting backplates and ETAs were confirmed at the start of the month. After our calls on fireplaces and lighting (April 9 and 10), the schedule was revised to match what we discussed. Suite 3 received new lighting options. Decorative accent lighting notes were written for correspondence. The 3D model was updated with current lighting selections and new renderings, including the entry ceiling. Lighting inspiration and final lighting selections were refreshed at month’s end.')]
  }),

  p({
    spacing: { before: 80, after: 120 },
    children: [new TextRun({ text: 'Meetings and site', font: 'Georgia', size: 26, bold: true, color: NAVY })]
  }),
  p({
    numbering: { reference: 'bullets', level: 0 },
    spacing: { after: 80 },
    children: [run('April 9 and 10 — calls with you on fireplaces and lighting, then lighting revisions the same week.')]
  }),
  p({
    numbering: { reference: 'bullets', level: 0 },
    spacing: { after: 80 },
    children: [run('April 13 — cabinet revisions, reviewed with you; Suite 3 updates and schedule work the same day.')]
  }),
  p({
    numbering: { reference: 'bullets', level: 0 },
    spacing: { after: 200 },
    children: [run('April 27 — job-site walk-through and cabinet finishes, with travel to and from the meeting.')]
  }),

  p({
    spacing: { before: 80, after: 120 },
    children: [new TextRun({ text: 'Cabinets, rooms, and millwork', font: 'Georgia', size: 26, bold: true, color: NAVY })]
  }),
  p({
    spacing: { after: 200 },
    children: [run('Cabinet revisions were developed and discussed with you, then carried through a site walk focused on cabinet finishes. Suite 3 was updated. Bar shelf design was drawn. Master-bath windows were reviewed at the end of the month. Game-room SketchUp and theater slab samples were underway the first of April.')]
  }),

  p({
    spacing: { before: 80, after: 120 },
    children: [new TextRun({ text: 'Outdoor living', font: 'Georgia', size: 26, bold: true, color: NAVY })]
  }),
  p({
    spacing: { after: 200 },
    children: [run('Outdoor layouts began mid-month. BBQ and bar materials and selections were developed, followed by the outdoor landscape plan, then a combined pass on cabinets, finishes, landscape, and the pool house. A short BBQ follow-up closed that thread before month’s end.')]
  }),

  p({
    spacing: { before: 80, after: 120 },
    children: [new TextRun({ text: 'Drawings, boards, and samples', font: 'Georgia', size: 26, bold: true, color: NAVY })]
  }),
  p({
    spacing: { after: 160 },
    children: [run('Room boards were kept current as lighting and finish decisions landed. Inspiration boards were organized and updated across the house — including bathrooms, plumbing, theaters, fireplaces, dining, great room, laundry and mudroom, fabric, paint palettes, and room renderings (noted as not final furnishings or materials). Lighting and Final Lighting Selections were updated April 30. Theater slab samples were reviewed at the start of the month.')]
  }),

  p({
    spacing: { before: 80, after: 120 },
    children: [new TextRun({ text: 'Week by week', font: 'Georgia', size: 26, bold: true, color: NAVY })]
  }),
  p({
    spacing: { after: 40 },
    children: [new TextRun({ text: 'April 1–2', font: 'Calibri', size: 22, bold: true, color: NAVY })]
  }),
  p({
    spacing: { after: 160 },
    children: [run('Game-room SketchUp and theater slab samples. Exterior lighting backplates and ETAs.')]
  }),
  p({
    spacing: { after: 40 },
    children: [new TextRun({ text: 'April 6–11', font: 'Calibri', size: 22, bold: true, color: NAVY })]
  }),
  p({
    spacing: { after: 160 },
    children: [run('Lighting schedules, specifications, and proposals; room-board updates. Two calls with you on fireplaces and lighting, then revisions. Outdoor layouts. April 9 lighting-schedule time (2.25 hours) was not billed.')]
  }),
  p({
    spacing: { after: 40 },
    children: [new TextRun({ text: 'April 13–17', font: 'Calibri', size: 22, bold: true, color: NAVY })]
  }),
  p({
    spacing: { after: 160 },
    children: [run('Cabinet revisions with you. Suite 3 lighting options and schedule updates. Lighting specifications and decorative accent-lighting notes. Outdoor BBQ and bar materials. Model updates with lighting selections, new renderings, and entry-ceiling renderings. April 14 lighting-schedule time (2.25 hours) was not billed.')]
  }),
  p({
    spacing: { after: 40 },
    children: [new TextRun({ text: 'April 21–24', font: 'Calibri', size: 22, bold: true, color: NAVY })]
  }),
  p({
    spacing: { after: 160 },
    children: [run('Outdoor landscape plan. Cabinets, finishes, landscape, and pool house. Bar shelf design.')]
  }),
  p({
    spacing: { after: 40 },
    children: [new TextRun({ text: 'April 27–30', font: 'Calibri', size: 22, bold: true, color: NAVY })]
  }),
  p({
    spacing: { after: 240 },
    children: [run('Job-site walk-through and cabinet finishes. Lighting schedules. BBQ follow-up. Master-bath windows.')]
  }),

  p({
    spacing: { before: 80, after: 200 },
    border: { top: { color: GOLD, space: 8, size: 6, style: BorderStyle.SINGLE } },
    children: [run('This update is drawn from the April studio record for Cloud — Rolling Hills. Product invoices issued in the same month are separate from this design-services invoice. Complimentary hours are listed on INV-6079 at $0.00 so they are not mistaken for billed time.', { size: 18, color: MUTED, italics: true })]
  }),
  p({
    spacing: { after: 40 },
    children: [new TextRun({ text: 'With care,', font: 'Georgia', italics: true, size: 22, color: NAVY })]
  }),
  p({
    spacing: { after: 0 },
    children: [new TextRun({ text: 'Cindy Holloway', font: 'Georgia', size: 22, color: NAVY })]
  }),
  p({
    children: [new TextRun({ text: 'CCH Design', font: 'Calibri', size: 20, color: MUTED })]
  })
];

const doc = new Document({
  styles: {
    default: { document: { run: { font: 'Calibri', size: 22 } } }
  },
  numbering: {
    config: [
      {
        reference: 'bullets',
        levels: [{
          level: 0,
          format: LevelFormat.BULLET,
          text: '•',
          alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } }
        }]
      }
    ]
  },
  sections: [{
    properties: {
      page: {
        size: { width: 12240, height: 15840 },
        margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 }
      }
    },
    headers: {
      default: new Header({
        children: [p({
          alignment: AlignmentType.RIGHT,
          children: [new TextRun({ text: 'CCH Design  ·  Confidential', font: 'Calibri', size: 16, color: MUTED })]
        })]
      })
    },
    footers: {
      default: new Footer({
        children: [p({
          alignment: AlignmentType.RIGHT,
          children: [
            new TextRun({ text: 'INV-6079  ·  April 2026  ·  ', font: 'Calibri', size: 16, color: MUTED }),
            new TextRun({ children: [PageNumber.CURRENT], font: 'Calibri', size: 16, color: MUTED })
          ]
        })]
      })
    },
    children: children
  }]
});

const dest = path.join(__dirname, '..', 'Docs', 'RH_April_2026_Project_Update_INV-6079_CCH_Oct07.docx');
Packer.toBuffer(doc).then((buffer) => {
  fs.writeFileSync(dest, buffer);
  console.log('Wrote', dest);
}).catch((e) => {
  console.error(e);
  process.exit(1);
});
