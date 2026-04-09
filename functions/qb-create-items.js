const fetch = require('node-fetch');
const QB_CLIENT_ID = 'ABIdgpUOB12gSW5FUrfixcQRQXtLNlRr4SXf0kkpxUSpe35qFR';
const QB_CLIENT_SECRET = 'AWNiPZvn8eFOLeiAhBtXZlUWRwPWulAZpSpiAAEc';
const REFRESH_TOKEN = 'RT1-46-H0-1784248302nr3y5gviifq6eu387qnb';
const REALM_ID = '9341456810119653';

async function run() {
  // Get access token
  const basicAuth = Buffer.from(QB_CLIENT_ID + ':' + QB_CLIENT_SECRET).toString('base64');
  const tokenRes = await fetch('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Authorization': 'Basic ' + basicAuth },
    body: 'grant_type=refresh_token&refresh_token=' + REFRESH_TOKEN
  });
  const tokens = await tokenRes.json();
  if (!tokens.access_token) { console.log('Token error:', JSON.stringify(tokens)); return; }
  console.log('Got access token');

  const base = 'https://sandbox-quickbooks.api.intuit.com/v3/company/' + REALM_ID;
  const h = { 'Authorization': 'Bearer ' + tokens.access_token, 'Content-Type': 'application/json', 'Accept': 'application/json' };

  // Create Service items that map to our Studio accounts
  const items = [
    { Name: 'Studio Product', Type: 'Service', IncomeAccountRef: { value: '1150040000' }, ExpenseAccountRef: { value: '1150040005' } },
    { Name: 'Studio Design Fee', Type: 'Service', IncomeAccountRef: { value: '1150040001' }, ExpenseAccountRef: { value: '1150040008' } },
    { Name: 'Studio Shipping', Type: 'Service', IncomeAccountRef: { value: '1150040002' }, ExpenseAccountRef: { value: '1150040006' } },
    { Name: 'Studio Prepaid Tax', Type: 'Service', IncomeAccountRef: { value: '1150040003' }, ExpenseAccountRef: { value: '1150040007' } },
    { Name: 'Studio Reimbursable', Type: 'Service', IncomeAccountRef: { value: '1150040004' }, ExpenseAccountRef: { value: '1150040005' } },
    { Name: 'Studio Subcontractor', Type: 'Service', IncomeAccountRef: { value: '1150040001' }, ExpenseAccountRef: { value: '1150040008' } },
    { Name: 'Studio Sample', Type: 'Service', IncomeAccountRef: { value: '1150040000' }, ExpenseAccountRef: { value: '1150040009' } }
  ];

  const itemMap = {};
  for (const item of items) {
    const r = await fetch(base + '/item', { method: 'POST', headers: h, body: JSON.stringify(item) });
    const d = await r.json();
    if (d.Item) {
      itemMap[item.Name] = d.Item.Id;
      console.log('Created:', item.Name, '-> ID:', d.Item.Id);
    } else {
      console.log('Error:', item.Name, d.Fault ? d.Fault.Error[0].Message : JSON.stringify(d));
    }
  }

  console.log('\nItem map:', JSON.stringify(itemMap, null, 2));
  console.log('\nNew refresh token:', tokens.refresh_token);
}
run().catch(e => console.error(e));
