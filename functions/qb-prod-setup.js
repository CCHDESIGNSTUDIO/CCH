const fetch = require('node-fetch');
const QB_CLIENT_ID = 'ABANZD7ynJxIwmujoEXbztoyHJHO3AHpoRNBGD0J4AJq7pwL33';
const QB_CLIENT_SECRET = 'p6ebqg4HUwBKcuxALaGhvN0BFkWl5xqKCXJCvLUJ';
const REFRESH_TOKEN = 'XAB11775694942ko5C3gIy5teT9bUfPdLZFsFTfRwettdcHUEd';
const REALM_ID = '1389735275';

async function run() {
  const basicAuth = Buffer.from(QB_CLIENT_ID + ':' + QB_CLIENT_SECRET).toString('base64');
  const tokenRes = await fetch('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Authorization': 'Basic ' + basicAuth },
    body: 'grant_type=refresh_token&refresh_token=' + REFRESH_TOKEN
  });
  const tokens = await tokenRes.json();
  if (!tokens.access_token) { console.log('Token error:', JSON.stringify(tokens)); return; }
  console.log('Got production access token!');

  const base = 'https://quickbooks.api.intuit.com/v3/company/' + REALM_ID;
  const h = { 'Authorization': 'Bearer ' + tokens.access_token, 'Content-Type': 'application/json', 'Accept': 'application/json' };

  // First check if accounts already exist
  console.log('\n1. Creating Studio accounts...');
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

  const acctMap = {};
  for (const a of accounts) {
    // Check if exists
    const q = await fetch(base + '/query?query=' + encodeURIComponent("select * from Account where Name = '" + a.Name.replace(/'/g, "\\'") + "'"), { headers: h });
    const qd = await q.json();
    if (qd.QueryResponse && qd.QueryResponse.Account && qd.QueryResponse.Account.length > 0) {
      acctMap[a.Name.split(' - ')[0].trim()] = qd.QueryResponse.Account[0].Id;
      console.log('  Exists:', a.Name, '-> ID:', qd.QueryResponse.Account[0].Id);
      continue;
    }
    const r = await fetch(base + '/account', { method: 'POST', headers: h, body: JSON.stringify(a) });
    const d = await r.json();
    if (d.Account) {
      acctMap[a.Name.split(' - ')[0].trim()] = d.Account.Id;
      console.log('  Created:', a.Name, '-> ID:', d.Account.Id);
    } else {
      console.log('  Error:', a.Name, d.Fault ? d.Fault.Error[0].Message + ' ' + d.Fault.Error[0].Detail : JSON.stringify(d));
    }
  }

  console.log('\n2. Creating Studio QB Items...');
  const items = [
    { Name: 'Studio Product', Type: 'Service', IncomeAccountRef: { value: acctMap.R1 }, ExpenseAccountRef: { value: acctMap.C1 } },
    { Name: 'Studio Design Fee', Type: 'Service', IncomeAccountRef: { value: acctMap.R2 }, ExpenseAccountRef: { value: acctMap.C4 } },
    { Name: 'Studio Shipping', Type: 'Service', IncomeAccountRef: { value: acctMap.R3 }, ExpenseAccountRef: { value: acctMap.C2 } },
    { Name: 'Studio Prepaid Tax', Type: 'Service', IncomeAccountRef: { value: acctMap.R4 }, ExpenseAccountRef: { value: acctMap.C3 } },
    { Name: 'Studio Reimbursable', Type: 'Service', IncomeAccountRef: { value: acctMap.R5 }, ExpenseAccountRef: { value: acctMap.C1 } },
    { Name: 'Studio Subcontractor', Type: 'Service', IncomeAccountRef: { value: acctMap.R2 }, ExpenseAccountRef: { value: acctMap.C4 } },
    { Name: 'Studio Sample', Type: 'Service', IncomeAccountRef: { value: acctMap.R1 }, ExpenseAccountRef: { value: acctMap.C5 } }
  ];

  const itemMap = {};
  for (const item of items) {
    // Check if exists
    const q = await fetch(base + '/query?query=' + encodeURIComponent("select * from Item where Name = '" + item.Name + "'"), { headers: h });
    const qd = await q.json();
    if (qd.QueryResponse && qd.QueryResponse.Item && qd.QueryResponse.Item.length > 0) {
      itemMap[item.Name] = qd.QueryResponse.Item[0].Id;
      console.log('  Exists:', item.Name, '-> ID:', qd.QueryResponse.Item[0].Id);
      continue;
    }
    const r = await fetch(base + '/item', { method: 'POST', headers: h, body: JSON.stringify(item) });
    const d = await r.json();
    if (d.Item) {
      itemMap[item.Name] = d.Item.Id;
      console.log('  Created:', item.Name, '-> ID:', d.Item.Id);
    } else {
      console.log('  Error:', item.Name, d.Fault ? d.Fault.Error[0].Message : JSON.stringify(d));
    }
  }

  console.log('\n=== RESULTS ===');
  console.log('Account Map:', JSON.stringify(acctMap, null, 2));
  console.log('Item Map:', JSON.stringify(itemMap, null, 2));
  console.log('New Refresh Token:', tokens.refresh_token);
  console.log('\nFirestore update command:');
  console.log("firebase.firestore().collection('admin').doc('qb').set(" + JSON.stringify({
    refreshToken: tokens.refresh_token,
    realmId: REALM_ID,
    accountMap: acctMap,
    connectedAt: new Date().toISOString()
  }) + ", { merge: true }).then(() => alert('Production QB saved!'))");
}
run().catch(e => console.error(e));
