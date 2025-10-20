const Razorpay = require('razorpay');
const crypto = require('crypto');

// ✅ Initialize Razorpay with environment variables
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// ✅ Course data (same as before)
const coursesDictionary = {
  glitch_the_matrix: {
    name: 'Full Vault Access',
    price: 1,
    downloadLink: 'https://drive.google.com/uc?export=download&id=1c-derRuqDkC89cW5kTCp8ujFO1zc3Nsw',
    image: 'https://github.com/glitchingthroughmatrix/image-hosting/blob/main/Break%20the%20matrix%20thumbnail%20on%20website.png?raw=true',
    description:
      'Complete access to all premium courses including financial strategies, investment techniques, and business development resources.',
    readMoreLink: 'google.com',
  },
  andrew_tate: {
    name: 'Andrew Tate Courses',
    price: 79,
    downloadLink: 'https://drive.google.com/uc?export=download&id=149LFArfYaOsqSJHYxsghVC3kSIhpQVyH',
    image: 'https://github.com/glitchingthroughmatrix/image-hosting/blob/main/Andrew%20tate%20all%20course.png?raw=true',
    description:
      "Learn from Andrew Tate's proven strategies for wealth creation, business mastery, and personal development.",
    readMoreLink: 'google.com',
  },
  luke_belmar: {
    name: 'Luke Belmar Courses',
    price: 79,
    downloadLink: 'https://drive.google.com/uc?export=download&id=1YQzTFUm_ud5qOzLYwqaGzSd5heAW_RqY',
    image: 'https://github.com/glitchingthroughmatrix/image-hosting/blob/main/Luke%20Belmar.png?raw=true',
    description:
      "Master digital entrepreneurship and online business strategies with Luke Belmar's cutting-edge methodologies.",
    readMoreLink: 'google.com',
  },
  iman_gadzhi: {
    name: 'Iman Gadzhi Courses',
    price: 79,
    downloadLink: 'https://drive.google.com/uc?export=download&id=1lUoOdmzG6Oqzz6qRrqkIuldz1V01wpK3',
    image: 'https://github.com/glitchingthroughmatrix/image-hosting/blob/main/Iman%20Gadzhi.png?raw=true',
    description:
      "Build successful agencies and scale your business using Iman Gadzhi's proven marketing frameworks.",
    readMoreLink: 'google.com',
  },
};

// ✅ In-memory order tracking (for verification return)
let ordersData = [];

/**
 * Helper: Verify Razorpay signature using crypto
 */
function verifySignature(orderId, paymentId, signature, secret) {
  const body = `${orderId}|${paymentId}`;
  const expectedSignature = crypto.createHmac('sha256', secret).update(body).digest('hex');
  return expectedSignature === signature;
}

/**
 * ✅ Main Vercel API handler
 */
module.exports = async (req, res) => {
  const { method, url } = req;

  // Enable CORS for frontend requests
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (method === 'OPTIONS') return res.status(200).end();

  try {
    // GET → /api/get-notes
    if (url === '/api/get-notes' && method === 'GET') {
      const courseList = Object.keys(coursesDictionary).map((key) => ({
        id: key,
        name: coursesDictionary[key].name,
        price: coursesDictionary[key].price,
        image: coursesDictionary[key].image,
        description: coursesDictionary[key].description,
        readMoreLink: coursesDictionary[key].readMoreLink,
      }));
      return res.status(200).json(courseList);
    }

    // POST → /api/create-order
    if (url === '/api/create-order' && method === 'POST') {
      const body = req.body || {};
      const { selectedNote, name, email, contact } = body;

      if (!coursesDictionary[selectedNote]) {
        return res.status(400).json({ error: 'Invalid course selected' });
      }

      const course = coursesDictionary[selectedNote];
      const amount = course.price * 100; // Convert to paise

      const options = {
        amount,
        currency: 'INR',
        receipt: `order_${Date.now()}`,
        notes: {
          product: selectedNote,
          product_name: course.name,
          download_link: course.downloadLink,
          customer_name: name,
          customer_email: email,
          customer_contact: contact,
          venture: 'Glitch',
        },
      };

      const order = await razorpay.orders.create(options);

      ordersData.push({
        order_id: order.id,
        status: 'created',
        ...options.notes,
        amount,
        currency: 'INR',
        created_at: new Date().toISOString(),
      });

      return res.status(200).json(order);
    }

    // POST → /api/verify-payment
    if (url === '/api/verify-payment' && method === 'POST') {
      const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

      const secret = process.env.RAZORPAY_KEY_SECRET;
      const isValid = verifySignature(razorpay_order_id, razorpay_payment_id, razorpay_signature, secret);

      if (!isValid) {
        return res.status(400).json({ status: 'verification_failed' });
      }

      const order = ordersData.find((o) => o.order_id === razorpay_order_id);
      if (!order) {
        return res.status(404).json({ status: 'error', message: 'Order not found' });
      }

      order.status = 'paid';
      order.payment_id = razorpay_payment_id;
      order.paid_at = new Date().toISOString();

      return res.status(200).json({
        status: 'ok',
        order_id: razorpay_order_id,
        payment_id: razorpay_payment_id,
        download_link: order.download_link,
        product_name: order.product_name,
      });
    }

    // Default route
    return res.status(404).json({ message: 'Invalid endpoint' });
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};
