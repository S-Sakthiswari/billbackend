const express = require('express');
const router = express.Router();
const twilio = require('twilio');

console.log('\n🔧 WhatsApp Routes Initializing...');

// ========== TWILIO INITIALIZATION ==========
const {
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  TWILIO_WHATSAPP_FROM
} = process.env;

let twilioClient = null;

if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_WHATSAPP_FROM) {
  console.error('❌ Twilio environment variables missing');
} else {
  twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
  console.log('✅ Twilio client initialized');
  console.log('📤 WhatsApp FROM:', TWILIO_WHATSAPP_FROM);
}

// ========== PHONE FORMAT HELPER ==========
const formatPhoneNumber = (phone) => {
  if (!phone) return null;

  const cleaned = phone.toString().replace(/\D/g, '');

  if (cleaned.length === 10) {
    return `+91${cleaned}`; // India
  }

  if (cleaned.length > 10) {
    return `+${cleaned}`;
  }

  return null;
};

// ========== STATUS CHECK ==========
router.get('/status', (req, res) => {
  res.json({
    twilioInitialized: !!twilioClient,
    whatsappFrom: TWILIO_WHATSAPP_FROM,
    timestamp: new Date().toISOString()
  });
});

// ========== SEND WHATSAPP MESSAGE ==========
router.post('/send', async (req, res) => {
  console.log('\n📨 WhatsApp send request received');

  try {
    if (!twilioClient) {
      return res.status(500).json({
        success: false,
        error: 'Twilio client not initialized'
      });
    }

    const { phone, message } = req.body;

    if (!phone || !message) {
      return res.status(400).json({
        success: false,
        error: 'Phone and message are required'
      });
    }

    const formattedPhone = formatPhoneNumber(phone);
    if (!formattedPhone) {
      return res.status(400).json({
        success: false,
        error: 'Invalid phone number format'
      });
    }

    console.log(`📤 From: ${TWILIO_WHATSAPP_FROM}`);
    console.log(`📱 To: whatsapp:${formattedPhone}`);

    const result = await twilioClient.messages.create({
      from: TWILIO_WHATSAPP_FROM,          // ✅ already whatsapp:+14155238886
      to: `whatsapp:${formattedPhone}`,   // ✅ add prefix ONLY here
      body: message
    });

    console.log('✅ WhatsApp sent:', result.sid);

    res.json({
      success: true,
      messageId: result.sid,
      status: result.status
    });

  } catch (error) {
    console.error('❌ WhatsApp error:', error.message);

    let errorMessage = error.message;
    if (error.code === 21211) errorMessage = 'Invalid phone number';
    if (error.code === 21608) errorMessage = 'User must join WhatsApp sandbox';
    if (error.code === 21408) errorMessage = 'User has not opted in';

    res.status(500).json({
      success: false,
      error: errorMessage,
      code: error.code
    });
  }
});

// ========== TEST ENDPOINT ==========
router.post('/test-send', async (req, res) => {
  try {
    const testPhone = req.body.testPhone || '8610586534';
    const formattedPhone = formatPhoneNumber(testPhone);

    if (!formattedPhone) {
      return res.status(400).json({
        success: false,
        error: 'Invalid test phone number'
      });
    }

    const result = await twilioClient.messages.create({
      from: TWILIO_WHATSAPP_FROM,
      to: `whatsapp:${formattedPhone}`,
      body: '✅ WhatsApp test message from Billing System'
    });

    res.json({
      success: true,
      messageId: result.sid
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
