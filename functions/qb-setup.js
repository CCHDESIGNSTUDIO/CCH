const http = require('http');
const fetch = require('node-fetch');
const { execSync } = require('child_process');

const QB_CLIENT_ID = 'ABIdgpUOB12gSW5FUrfixcQRQXtLNlRr4SXf0kkpxUSpe35qFR';
const QB_CLIENT_SECRET = 'AWNiPZvn8eFOLeiAhBtXZlUWRwPWulAZpSpiAAEc';
const REDIRECT = 'http://localhost:8080/callback';
const SANDBOX_REALM = '9341456810119653';

async function exchangeCode(code) {
  const basicAuth = Buffer.from(QB_CLIENT_ID + ':' + QB_CLIENT_SECRET).toString('base64');
  const res = await fetch('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Authorization': 'Basic ' + basicAuth },
    body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: REDIRECT }).toString()
  });
  return res.json();
}

async function createAccounts(accessToken, realmId) {
  const base = 'https://sandbox-quickbooks.api.intuit.com/v3/company/' + realmId;
  const accounts = [
    { Name: 'R1 - Studio Product Sales', AccountType: 'Income', AccountSubType: 'SalesOfProductIncome' },
    { Name: 'R2 - Studio Design Fees', AccountType: 'Income', AccountSubType: 'ServiceFeeIncome' },
    { Name: 'R3 - Studio Shipping', AccountType: 'Income', AccountSubType: 'OtherPrimaryIncome' },
    { Name: 'R4 - Studio Prepaid Tax', AccountType: 'Income', AccountSubType: 'OtherPrimaryIncome' },
    { Name: 'R5 - Studio Reimbursable', AccountType: 'Income', AccountSubType: 'OtherPrimaryIncome' },
    { Name: 'C1 - Studio Product Cost', AccountType: 'Cost of Goods Sold', AccountSubType: 'SuppliesMaterialsCogs' },
    { Name: 'C2 - Studio Freight/Shipping', AccountType: 'Cost of Goods Sold', AccountSubType: 'ShippingFreightDeliveryCos' },
    { Name: 'C3 - Studio Sales Tax Paid', AccountType: 'Cost of Goods Sold', AccountSubType: 'OtherCostsOfServiceCos' },
    { Name: 'C4 - Studio Subcontractors', AccountType: 'Cost of Goods Sold', AccountSubType: 'OtherCostsOfServiceCos' },
    { Name: 'C5 - Studio Samples', AccountType: 'Cost of Goods Sold', AccountSubType: 'OtherCostsOfServiceCos' }
  ];
  const map = {};
  for (const a of accounts) {
    const r = await fetch(base + '/account', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + accessToken, 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(a)
    });
    const d = await r.json();
    if (d.Account) { map[a.Name.split(' - ')[0].trim()] = d.Account.Id; console.log('  Created:', a.Name, '-> ID:', d.Account.Id); }
    else console.log('  Skipped:', a.Name, d.Fault ? d.Fault.Error[0].Message : '');
  }
  return map;
}

// Start server, open browser, wait for callback
const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://localhost:8080');
  const code = u.searchParams.get('code');
  const realmId = u.searchParams.get('realmId') || SANDBOX_REALM;
  if (!code) { res.writeHead(200); res.end('Waiting...'); return; }

  console.log('\n=== Got authorization code ===');
  console.log('Realm ID:', realmId);

  // Step 1: Exchange code for tokens
  console.log('\n1. Exchanging code for tokens...');
  const tokens = await exchangeCode(code);
  if (!tokens.access_token) {
    console.log('ERROR:', JSON.stringify(tokens));
    res.writeHead(500, {'Content-Type':'text/html'});
    res.end('<h1 style="color:red">Token exchange failed</h1><pre>' + JSON.stringify(tokens, null, 2) + '</pre>');
    process.exit(1);
  }
  console.log('   Access token obtained!');
  console.log('   Refresh token:', tokens.refresh_token);

  // Step 2: Create accounts
  console.log('\n2. Creating Studio accounts in QuickBooks...');
  const map = await createAccounts(tokens.access_token, realmId);
  console.log('\n   Account map:', JSON.stringify(map, null, 2));

  // Step 3: Output everything
  console.log('\n=== SAVE THESE VALUES ===');
  console.log('Refresh Token:', tokens.refresh_token);
  console.log('Realm ID:', realmId);
  console.log('Account Map:', JSON.stringify(map));
  console.log('=========================\n');

  res.writeHead(200, {'Content-Type':'text/html'});
  res.end(`<html><body style="font-family:sans-serif;text-align:center;padding:40px;">
    <h1 style="color:#5FA56B;">QuickBooks Setup Complete!</h1>
    <p>Created ${Object.keys(map).length} accounts</p>
    <pre style="text-align:left;background:#f5f5f5;padding:20px;max-width:600px;margin:20px auto;">${JSON.stringify(map, null, 2)}</pre>
    <p>Refresh token saved. You can close this window.</p>
    <p><a href="https://cch-platform.web.app">Open CCH Studio</a></p>
  </body></html>`);

  setTimeout(() => process.exit(0), 3000);
});

server.listen(8080, () => {
  const authUrl = 'https://appcenter.intuit.com/connect/oauth2?client_id=' + QB_CLIENT_ID +
    '&response_type=code&scope=com.intuit.quickbooks.accounting' +
    '&redirect_uri=' + encodeURIComponent(REDIRECT) + '&state=cchsetup';
  console.log('Server running on http://localhost:8080');
  console.log('Opening browser for authorization...\n');
  try { execSync('start "" "' + authUrl + '"'); } catch(e) {}
});
