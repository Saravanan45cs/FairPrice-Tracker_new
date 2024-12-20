const express = require('express');
const app=express();
const router = express.Router();
const multer = require('multer');
const bcrypt = require('bcryptjs');
const db = require('./db');
const xlsx = require('xlsx');
const twilio = require('twilio');
const nodemailer = require('nodemailer');
const pdfkit = require('pdfkit');
const fs = require('fs');
require('dotenv').config({ path: '../id.env' });




// Multer configuration for file upload
const upload = multer({ dest: 'uploads/' }).single('file');


// Update shop status
app.post("/api/updateShopStatus", (req, res) => {
  const { shopId, status, remarks } = req.body;

  db.query(
    "UPDATE Shops SET status = ?, remarks = ? WHERE shop_id = ?",
    [status, remarks, shopId],
    (err) => {
      if (err) return res.status(500).send(err.message);
      res.send("Shop status updated.");
    }
  );
});

// Function to convert "10:00 AM" format to "HH:MM:SS" format
function convertTo24HourFormat(time) {
  // If the time is a number (Excel time in decimal)
  if (typeof time === 'number') {
    // Convert Excel time (fraction of a day) to HH:mm format
    const hours = Math.floor(time * 24); // Get hours
    const minutes = Math.round((time * 24 - hours) * 60); // Get minutes

    // Return in 24-hour format
    return `${hours < 10 ? '0' + hours : hours}:${minutes < 10 ? '0' + minutes : minutes}:00`;
  }

  // If the time is a string (12-hour format like 10:00 AM)
  if (typeof time === 'string') {
    const [timePart, modifier] = time.split(' '); // Split time and modifier (AM/PM)

    if (!timePart || !modifier) {
      throw new Error(`Invalid time format: ${time}`);
    }

    let [hours, minutes] = timePart.split(':'); // Split hours and minutes
    if (hours === '12') hours = '00'; // Convert 12 AM to 00 in 24-hour format
    if (modifier === 'PM' && hours !== '12') hours = parseInt(hours, 10) + 12; // Convert PM times

    return `${hours}:${minutes}:00`; // Return in 24-hour format
  }

  // If the time format is neither a number nor a string, throw an error
  throw new Error(`Invalid time format: ${time}`);
}



// Temporary bypass: Function to simulate login without JWT
function mockGenerateToken(user) {
  // Simulate a "valid" token (mocked token)
  return `${user.username}-mock-token`; 
}

// Login API
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  // Check if username and password are provided
  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required' });
  }

  try {
    const [rows] = await db.promise().query('SELECT * FROM Users WHERE username = ?', [username]);
    if (rows.length === 0) return res.status(401).json({ message: 'User not found' });

    const user = rows[0];
    const isPasswordMatch = await bcrypt.compare(password, user.password);
    if (!isPasswordMatch) return res.status(401).json({ message: 'Incorrect password' });

    // Generate a mock token
    const token = mockGenerateToken(user);
    res.json({ token, role: user.role });
  } catch (err) {
    console.error('Error during login:', err.message);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});
const calculatePoints = (status, remarks) => {
  let points = 0;

  // Example logic to calculate points based on status and remarks
  if (status.toLowerCase() === 'open') points += 10;
  if (status.toLowerCase() === 'closed') {
        if (remarks ==='NIL' || remarks ==='' || remarks ==='-') points -=3;
        else points += 3;
  }

  return points;
};


// Route to handle file upload for taluk role
router.post('/upload', (req, res) => {
  upload(req, res, async (err) => {
    if (err) {
      console.error('File upload error:', err.message);
      return res.status(400).json({ message: 'File upload error', error: err.message });
    }

    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

    try {
      // Read and parse the Excel file
      const workbook = xlsx.readFile(req.file.path);
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const data = xlsx.utils.sheet_to_json(sheet);

      // Insert each row from Excel into the Shops table in the database
      for (const row of data) {
        const {
          shop_id,
          shop_name,
          shop_incharge,
          incharge_number,
          email,
          opening_time,
          status,
          remarks,
          upload_batch,
          taluk,
          district
        } = row;
        const formattedOpeningTime = convertTo24HourFormat(opening_time);
        const formattedUploadBatch = convertTo24HourFormat(upload_batch);
        
        // Insert the shop data into the shops table
        await db.promise().query(
          'INSERT INTO shops (shop_code, shop_name, shop_incharge, incharge_number, email, opening_time, status, remarks, upload_batch,taluk,district) VALUES ( ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,?)',
          [
            shop_id,
            shop_name,
            shop_incharge,
            incharge_number,
            email,
            formattedOpeningTime,
            status,
            remarks,
            formattedUploadBatch,
            taluk,
            district
          ]
        );

        // Calculate points and insert into the shoppoints table
        const points = calculatePoints(status, remarks);
        await db.promise().query(
          `INSERT INTO shoppoints (shop_code, shop_name,taluk,district,points,upload_batch) VALUES (?, ?, ?, ?, ?,?)`,
          [shop_id, shop_name, taluk, district, points, upload_batch]
        );
      }

      // Now, after all insertions, query for closed shops once
      const [closedShops] = await db.promise().query(
        `SELECT shop_code, shop_name, taluk, district,upload_batch
         FROM shops
         WHERE remarks IN ('-','','NIL') AND status = 'Closed'
         `
      );
      console.log('Closed shops:', closedShops);

      // Insert the closed shops in bulk into the closed_shops table
      if (closedShops.length > 0) {
        for (let shop of closedShops) {
          // Check if the shop already exists in the closed_shops table
          const [existingShop] = await db.promise().query(
            `SELECT 1 FROM closed_shops WHERE shop_code = ? AND upload_batch = ?`,
            [shop.shop_code, shop.upload_batch]
          );

          if (existingShop.length === 0) {
            // Insert into the closed_shops table if it doesn't already exist
            await db.promise().query(
              `INSERT INTO closed_shops (shop_code, shop_name, taluk, district, upload_batch) 
               VALUES (?, ?, ?, ?, ?)`,
              [shop.shop_code, shop.shop_name, shop.taluk, shop.district, shop.upload_batch]
            );
          }
        }
      }


      res.json({ message: 'File uploaded and data stored successfully' });
    } catch (error) {
      console.error('Error processing file:', error.message);
      res.status(500).json({ message: 'Error processing file', error: error.message });
    }
  });
});

const accountSid = process.env.ACCOUNT_SID;
const authToken = process.env.AUTH_TOKEN;
const twilioClient = twilio(accountSid, authToken);

// Your Twilio phone number
const twilioPhoneNumber = process.env.PHONE_NO;

// Nodemailer setup for sending emails
const transporter = nodemailer.createTransport({
  service: 'gmail',
  port: 587,
  secure: false,
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS
  }
});

// Endpoint to send notifications (SMS and Email)
router.post('/notify-shop/:shopId', async (req, res) => {
  const shopId = parseInt(req.params.shopId);
  - 
  console.log('Received shopId:', shopId);

  try {
    // Fetch shop details from the database
    const [shop] = await db.promise().query('SELECT * FROM shops WHERE shop_code = ?', [shopId]);
    console.log('Database response:', shop); // Debugging response

    if (shop.length === 0) {
      console.log('Shop not found in the database');
      return res.status(404).json({ error: 'Shop not found' });
    }

    const shopDetails = shop[0];
    const formattedNumber = `+91${shopDetails.incharge_number}`;
    console.log('Shop Details:', shopDetails); // Debugging shop details
    console.log('Formatted phone number:', formattedNumber); // Debugging formatted phone number

    // Sending WhatsApp message using Twilio
    await twilioClient.messages.create({
      body: `Shop ${shopDetails.shop_name} in ${shopDetails.taluk} is closed. Please check the status.`,
      from: `whatsapp:${process.env.WHATSAPP_NO}`,  // Twilio WhatsApp number
      to: `whatsapp:${formattedNumber}` // Shop's incharge number in WhatsApp format
    });
    console.log('WhatsApp message sent successfully'); // Confirmation log

    // Sending SMS (if needed) using Twilio
    await twilioClient.messages.create({
      body: `Shop ${shopDetails.shop_name} in ${shopDetails.taluk} is closed. Please check the status.`,
      from: twilioPhoneNumber, // Your Twilio phone number
      to: formattedNumber // Shop's incharge number
    });
    console.log('SMS sent successfully'); // Confirmation log

    // Sending email using Nodemailer
    await transporter.sendMail({
      from: process.env.GMAIL_USER,
      to: process.env.SENDER_MAIL,
      subject: 'Shop Status Alert',
      text: `Shop ${shopDetails.shop_name} in ${shopDetails.taluk} has been closed. Please check the status.`
    });
    console.log('Email sent successfully'); // Confirmation log

    res.status(200).json({ message: 'Notifications sent successfully' });
  } catch (error) {
    console.error('Error in notify-shop endpoint:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

// Endpoint to initiate a call for a closed shop
router.post('/call-shop/:shopId', async (req, res) => {
  const shopId = parseInt(req.params.shopId);
  console.log(shopId);
  try {
    // Fetch shop details from the database
    const [shop] = await db.promise().query('SELECT * FROM shops WHERE shop_code= ?', [shopId]);

    if (shop.length === 0) {
      return res.status(404).json({ error: 'Shop not found' });
    }

    const shopDetails = shop[0];
    formattedNumber=`+91${shopDetails.incharge_number}`;
    // Initiate a call using Twilio
    await twilioClient.calls.create({
      to: formattedNumber,
      from: twilioPhoneNumber,
      twiml: `<Response><Say>This is an alert from the taluk head office .
        The Fair Price Shop at your area has not been opened.
        Please take necessary actions immediately. Thank you!</Say></Response>`
    });

    res.status(200).json({ message: 'Call initiated successfully' });
  } catch (error) {
    console.error('Error in call-shop endpoint:', error);
    res.status(500).json({ error: error.message });
  }
});


app.get('/api/shoppoints', (req, res) => {
  const { district, taluk } = req.query;
  if (!district || !taluk) {
    return res.status(400).json({ error: 'District and Taluk are required' });
  }

  // Query to fetch shops based on district and taluk
  const query = 'SELECT DISTINCT shop_name FROM shops WHERE district = ? AND taluk = ?';
  db.promise().query(query, [district, taluk])
    .then(([results]) => {
      res.json(results);
    })
    .catch(err => {
      console.error('Error fetching shops:', err);
      res.status(500).json({ error: 'Database error' });
    });
});

router.post('/generate-report', async (req, res) => {
  try {
    // Step 1: Query closed shops for each batch
    const batches = ['10:00:00', '10:30:00', '11:00:00'];
    const reports = [];

    // Get today's date in YYYY-MM-DD format
    const today = new Date().toISOString().split('T')[0];

    for (const batch of batches) {
      const [closedShops] = await db.promise().query(
        `SELECT shop_code, shop_name, taluk, district, upload_batch 
         FROM closed_shops
         WHERE upload_batch = ? AND DATE(created_at) = ?`,
        [batch, today]
      );

      if (closedShops.length > 0) {
        let batchReport = `Batch ${batch}: \n`;
        closedShops.forEach(shop => {
          batchReport += `- Shop: ${shop.shop_name} in ${shop.taluk}, ${shop.district} has not been opened.\n`;
        });
        batchReport += '\nNotifications have been sent.\n';
        reports.push(batchReport);
      } else {
        let batchReport = `Batch ${batch}: \n`;
        batchReport += '- Every shop has been opened.\n';
        reports.push(batchReport);
      }
    }

    // Step 2: Generate PDF Report
    const doc = new pdfkit();
    const filePath = './reports/detailed_report.pdf';
    doc.pipe(fs.createWriteStream(filePath));

    doc.fontSize(18).text('Detailed Report for Closed Shops:', { align: 'center' });
    doc.moveDown();

    reports.forEach(report => {
      doc.fontSize(12).text(report);
      doc.moveDown();
    });

    doc.end();

    // Step 3: Send the PDF as an email attachment
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_PASS,
      },
    });

    const mailOptions = {
      from: process.env.GMAIL_USER,
      to: process.env.GMAIL_PASS,
      subject: 'Daily Report for Closed Shops',
      text: 'Please find the attached detailed report for closed shops.',
      attachments: [
        {
          filename: 'detailed_report.pdf',
          path: filePath,
        },
      ],
    };

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error('Error sending email:', error);
        return res.status(500).json({ message: 'Error sending email' });
      } else {
        console.log('Email sent:', info.response);
        return res.json({ success: true, message: 'Report sent successfully' });
      }
    });

  } catch (error) {
    console.error('Error generating report:', error);
    res.status(500).json({ message: 'Error generating report' });
  }
});

// Endpoint to send notifications (SMS and Email) for shops in a specific District
// Notify all shops in a specific district
router.post('/notify-district/:districtId', async (req, res) => {
  const districtId= parseInt(req.params.districtId);
  console.log('Received districtId:', districtId);

  try {
    // Fetch shop details from the database for the specific district
    const [shops] = await db.promise().query('SELECT * FROM shops WHERE shop_code = ?', [districtId]);
    console.log('Database response:', shops);
    shop=shops[0];
    console.log("shop: ",shop);
    if (shops.length === 0) {
      return res.status(404).json({ error: 'No shops found in this District' });
    }

      const formattedNumber = `+91${shop.incharge_number}`;

      // Sending SMS using Twilio
      await twilioClient.messages.create({
        body: `This is an alert message from the district office.Shop ${shop.shop_name} in ${shop.taluk} is closed. Please check the status.`,
        from: twilioPhoneNumber,
        to: formattedNumber
      });

      // Sending email using Nodemailer
      await transporter.sendMail({
        from: process.env.GMAIL_USER, // Use dynamic email if needed
        to: process.env.SENDER_MAIL,
        subject: 'Shop Status Alert',
        text: `This is an allert message from the district office.
        Shop ${shop.shop_name} in ${shop.district} has been closed. Please check the status.`
      });
    res.status(200).json({ message: 'Notifications sent successfully to all shops in District' });
  } catch (error) {
    console.error('Error in notify-district endpoint:', error);
    res.status(500).json({ error: error.message });
  }
});

// Initiate calls for all shops in the district
router.post('/call-district/:districtId', async (req, res) => {
  const districtId = parseInt(req.params.districtId);
  console.log('Received districtId:', districtId);

  try {
    const [shops] = await db.promise().query('SELECT * FROM shops WHERE shop_code = ?', [districtId]);
    shop=shops[0];
    console.log("shop: ",shop);
    if (shops.length === 0) {
      return res.status(404).json({ error: 'No shops found in this District' });
    }

      const formattedNumber = `+91${shop.incharge_number}`;

      // Initiate a call using Twilio
      await twilioClient.calls.create({
        to: formattedNumber,
        from: twilioPhoneNumber,
        twiml: `This is an alert from the district head office .
        The Fair Price Shop with shop code ${shop.shop_code} in taluk ${shop.taluk} in ${shop.district} has not been opened.
        Please take necessary actions immediately. Thank you!`
      });
    res.status(200).json({ message: 'Calls initiated successfully for all shops in District' });
  } catch (error) {
    console.error('Error in call-district endpoint:', error);
    res.status(500).json({ error: error.message });
  }
});



router.get('/district-data', async (req, res) => {
  const { district, batch } = req.query;
  console.log("Received query params:", district, batch); // Debug log
  if (!district || !batch) {
      return res.status(400).json({ error: "District and batch are required" });
  }
  try {
      const [rows] = await db.promise().query(
          `SELECT DISTINCT * FROM shops WHERE district = ? AND upload_batch = ?`,
          [district, batch]
      );
      console.log("Query result:", rows); // Debug log
      res.status(200).json(rows);
  } catch (error) {
      console.error("Error fetching data:", error);
      res.status(500).json({ error: "Database query failed" });
  }
});


module.exports = router;
