const token = "800|QNy2YL5p5kkEAVFK3FNi7RY8XaL8LrKYW71RA5XQ3262b7e9";

async function testCamerpay(phone, method, amount) {
  const payload = {
    payment_method: method,
    amount: amount,
    currency: 'XAF',
    merchant_invoice_id: 'RGP-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6).toUpperCase(),
    merchant_callback_url: 'https://rg-play.pages.dev/api/payment/notify',
    merchant_return_url: 'https://rg-play.pages.dev',
    source: 'api',
  };
  if (phone) {
    payload.customer_phone = phone;
  }

  console.log(`\n--- Testing [${method}] Phone: "${phone}" Amount: ${amount} ---`);

  try {
    const res = await fetch('https://camerpay.biz/api/payment/initiate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 CamerPay-Client/2.0'
      },
      body: JSON.stringify(payload)
    });

    console.log("Status HTTP:", res.status);
    const text = await res.text();
    console.log("Response Body:", text);
  } catch (err) {
    console.error("Fetch Error:", err);
  }
}

async function run() {
  await testCamerpay('699456779', 'orange_money', 2900);
  await testCamerpay('237699456779', 'orange_money', 2900);
  await testCamerpay('699456779', 'OM', 2900);
  await testCamerpay('670000000', 'mtn_momo', 2900);
  await testCamerpay('670000000', 'MOMO', 2900);
  await testCamerpay('', 'card', 2900);
  await testCamerpay('', 'visa', 2900);
}

run();
