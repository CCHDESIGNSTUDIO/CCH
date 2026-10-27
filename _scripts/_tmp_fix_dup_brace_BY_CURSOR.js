'use strict';
const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, '..', 'platform', 'cch-proposals-invoices-fix.js');
let s = fs.readFileSync(p, 'utf8');
const bad = `      '</div></div>';
  };
  };

  // ============================================================
  // 30. INVOICE/PO VIEW MODE`;
const good = `      '</div></div>';
  };

  // ============================================================
  // 30. INVOICE/PO VIEW MODE`;
if (!s.includes(bad)) {
  console.error('pattern not found');
  process.exit(1);
}
s = s.replace(bad, good);
fs.writeFileSync(p, s);
console.log('ok');
