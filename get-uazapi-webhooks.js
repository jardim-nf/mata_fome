// get-uazapi-webhooks.js
const fetch = require('node-fetch'); // Node 20 global fetch

const serverUrl = 'https://meunumero.uazapi.com';

async function checkWebhook(estabName, instanceName, apiKey) {
  const url = `${serverUrl}/webhook/find/${instanceName}`;
  console.log(`Checking webhook for [${estabName}] (${instanceName})...`);
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'token': apiKey,
        'apikey': apiKey
      }
    });
    console.log(`Status: ${res.status}`);
    const body = await res.text();
    console.log(`Body:`, body);
  } catch (err) {
    console.error(`Error:`, err.message);
  }
}

async function run() {
  // MeGusta
  await checkWebhook('MeGusta', 'MeGusta', '21374eb3-5923-4a62-8701-8b2bbf7ce4c4');
  
  console.log('\n--------------------\n');
  
  // Bougue Lanchonete
  await checkWebhook('Mata Fome Burguer', 'Bougue Lanchonete', 'de8aca2e-a0b4-46ea-a793-da8542e1b9cc');
}

run().catch(console.error);
