const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch (_) {
    return { statusCode: 400, body: 'Invalid JSON' };
  }

  const { name, email } = body;
  if (!name || !email) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Name and email are required.' }) };
  }

  const baseUrl = process.env.URL || 'https://getheadwaters.app';

  try {
    const session = await stripe.checkout.sessions.create({
      customer_email: email,
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'Headwaters — Founding Member Annual Access',
              description: 'Marketing mix modeling for tourism & hospitality businesses. Founding member rate — first 25 seats only.',
            },
            unit_amount: 29700, // $297.00 in cents
            recurring: { interval: 'year' },
          },
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${baseUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/checkout`,
      metadata: {
        customer_name: name,
      },
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: session.url }),
    };
  } catch (err) {
    console.error('Stripe error:', err.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
