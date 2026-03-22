const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const CALENDLY = 'https://calendly.com/matthewalighieri/30min';
const APP_URL  = 'https://headwaters.streamlit.app';

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  // Verify Stripe webhook signature
  const sig           = event.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let stripeEvent;
  try {
    stripeEvent = stripe.webhooks.constructEvent(event.body, sig, webhookSecret);
  } catch (err) {
    console.error('Webhook signature error:', err.message);
    return { statusCode: 400, body: `Webhook Error: ${err.message}` };
  }

  // Only handle completed checkouts
  if (stripeEvent.type !== 'checkout.session.completed') {
    return { statusCode: 200, body: 'Event ignored' };
  }

  const session      = stripeEvent.data.object;
  const customerEmail = session.customer_email;
  const customerName  = session.metadata?.customer_name || 'New Member';
  const notifyEmail   = process.env.NOTIFY_EMAIL || 'matt@matthewalighieri.com';
  const resendKey     = process.env.RESEND_API_KEY;

  if (!resendKey) {
    console.warn('RESEND_API_KEY not configured — skipping emails');
    return { statusCode: 200, body: 'No Resend key configured' };
  }

  const errors = [];

  // ── Customer confirmation email ──────────────────────────────────────────────
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Headwaters <onboarding@resend.dev>',
        to: customerEmail,
        subject: "You're in. Welcome to Headwaters.",
        html: `
          <div style="font-family:-apple-system,sans-serif;max-width:560px;margin:0 auto;color:#1E293B;">
            <div style="background:#0F2340;padding:28px 32px;border-radius:12px 12px 0 0;">
              <p style="color:#00B896;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;margin:0 0 8px;">Founding Member</p>
              <h1 style="color:#fff;font-size:24px;font-weight:800;margin:0;letter-spacing:-0.02em;">You're in. Welcome to Headwaters.</h1>
            </div>
            <div style="background:#fff;padding:32px;border:1px solid #E2E8F0;border-top:none;border-radius:0 0 12px 12px;">
              <p style="font-size:16px;color:#1E293B;margin:0 0 24px;">Hi ${customerName},</p>
              <p style="font-size:15px;color:#64748B;line-height:1.7;margin:0 0 24px;">
                Your founding member access to Headwaters is confirmed. Here's what to do next:
              </p>
              <div style="background:#F8FAFC;border-radius:10px;padding:20px 24px;margin-bottom:24px;">
                <p style="font-size:12px;font-weight:700;color:#00B896;text-transform:uppercase;letter-spacing:0.1em;margin:0 0 14px;">Next steps</p>
                <p style="font-size:14px;color:#1E293B;margin:0 0 12px;line-height:1.55;">
                  <strong>1. Go to Headwaters</strong> — upload your marketing data and run your first analysis.
                </p>
                <p style="font-size:14px;color:#1E293B;margin:0 0 12px;line-height:1.55;">
                  <strong>2. Download the CSV template</strong> — it shows you exactly how to format your spend and booking data.
                </p>
                <p style="font-size:14px;color:#1E293B;margin:0;line-height:1.55;">
                  <strong>3. Book your onboarding call</strong> — every founding member gets 15 minutes with Matthew to walk through setup and your first analysis.
                </p>
              </div>
              <div style="display:flex;flex-direction:column;gap:10px;">
                <a href="${APP_URL}"
                   style="display:block;text-align:center;padding:13px 24px;background:#00B896;color:#fff;text-decoration:none;border-radius:8px;font-weight:700;font-size:15px;">
                  Go to Headwaters →
                </a>
                <a href="${CALENDLY}"
                   style="display:block;text-align:center;padding:13px 24px;background:#0F2340;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">
                  Book Your Onboarding Call →
                </a>
              </div>
              <p style="color:#94A3B8;font-size:12px;margin-top:28px;line-height:1.6;">
                Questions? Reply to this email or reach out directly at
                <a href="mailto:matt@matthewalighieri.com" style="color:#64748B;">matt@matthewalighieri.com</a>
              </p>
              <p style="color:#CBD5E1;font-size:11px;margin-top:8px;">Headwaters · Built by New England Growth Studio</p>
            </div>
          </div>
        `,
      }),
    });
    if (!res.ok) errors.push('customer: ' + await res.text());
  } catch (e) {
    errors.push('customer: ' + e.message);
  }

  // ── Internal notification to Matthew ────────────────────────────────────────
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Headwaters <onboarding@resend.dev>',
        to: notifyEmail,
        subject: `New Headwaters customer — ${customerName}`,
        html: `
          <div style="font-family:-apple-system,sans-serif;max-width:520px;margin:0 auto;color:#1E293B;">
            <div style="background:#0F2340;padding:24px 28px;border-radius:12px 12px 0 0;">
              <p style="color:#00B896;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;margin:0 0 6px;">New Customer</p>
              <h1 style="color:#fff;font-size:20px;font-weight:800;margin:0;letter-spacing:-0.02em;">${customerName} just purchased Headwaters</h1>
            </div>
            <div style="background:#fff;padding:28px;border:1px solid #E2E8F0;border-top:none;border-radius:0 0 12px 12px;">
              <table style="width:100%;border-collapse:collapse;">
                <tr>
                  <td style="padding:10px 0;border-bottom:1px solid #F1F5F9;color:#64748B;font-size:13px;width:100px;">Name</td>
                  <td style="padding:10px 0;border-bottom:1px solid #F1F5F9;font-weight:600;">${customerName}</td>
                </tr>
                <tr>
                  <td style="padding:10px 0;border-bottom:1px solid #F1F5F9;color:#64748B;font-size:13px;">Email</td>
                  <td style="padding:10px 0;border-bottom:1px solid #F1F5F9;">
                    <a href="mailto:${customerEmail}" style="color:#0F2340;font-weight:600;">${customerEmail}</a>
                  </td>
                </tr>
                <tr>
                  <td style="padding:10px 0;color:#64748B;font-size:13px;">Amount</td>
                  <td style="padding:10px 0;font-size:20px;font-weight:800;color:#00B896;">$297/year</td>
                </tr>
              </table>
              <div style="margin-top:20px;">
                <a href="mailto:${customerEmail}"
                   style="display:inline-block;padding:11px 22px;background:#0F2340;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">
                  Email ${customerName} →
                </a>
              </div>
              <p style="color:#94A3B8;font-size:11px;margin-top:20px;">Headwaters · New England Growth Studio</p>
            </div>
          </div>
        `,
      }),
    });
    if (!res.ok) errors.push('notify: ' + await res.text());
  } catch (e) {
    errors.push('notify: ' + e.message);
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ ok: true, errors }),
  };
};
