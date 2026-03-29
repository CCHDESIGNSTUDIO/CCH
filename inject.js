const fs = require('fs');

// Step 1: Restore index.html to clean state (remove any broken injected code)
let t = fs.readFileSync('platform/index.html', 'utf8');

// Remove any previously injected functions (between our markers if they exist)
t = t.replace(/\/\/ ={5,} FINANCE HELPERS[\s\S]*?\/\/ ={5,} END INJECTED[\s\S]*?\n/g, '');

// Add script tag for our external functions file (before </body>)
if (!t.includes('cch-functions.js')) {
  t = t.replace('</body>', '  <script src="cch-functions.js"></script>\n</body>');
  console.log('✓ Added cch-functions.js script tag');
} else {
  console.log('- Script tag already present');
}

// Add Clients + Vendors to sidebar if not there
if (!t.includes('data-page="clients"')) {
  t = t.replace(
    '<button class="nav-item" data-page="library">',
    `<button class="nav-item" data-page="clients">
          <span class="nav-icon">👥</span><span class="nav-label">Clients</span>
        </button>
        <button class="nav-item" data-page="vendors">
          <span class="nav-icon">🏭</span><span class="nav-label">Vendors</span>
        </button>
        <button class="nav-item" data-page="library">`
  );
  console.log('✓ Sidebar: Clients + Vendors added');
}

// Add router cases
if (!t.includes("case 'clients':")) {
  t = t.replace(
    "case 'library': renderProductLibrary(); break;",
    `case 'clients': renderClients(); break;
        case 'vendors': renderVendors(); break;
        case 'library': renderProductLibrary(); break;`
  );
  console.log('✓ Router cases added');
}

fs.writeFileSync('platform/index.html', t);
console.log('✅ index.html updated. Lines:', t.split('\n').length);
console.log('Now copy cch-functions.js to the platform/ folder too!');
