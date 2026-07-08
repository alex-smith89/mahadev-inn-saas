// src/services/emailService.js
const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  async sendBookingConfirmation(booking, guestEmail) {
    const mailOptions = {
      from: process.env.SMTP_FROM || 'noreply@mahadevinn.com',
      to: guestEmail,
      subject: `Booking Confirmation - Mahadev Inn #${booking.bookingNo}`,
      html: `
        <h1>Booking Confirmation</h1>
        <p>Dear ${booking.agentName},</p>
        <p>Your booking has been confirmed.</p>
        <p><strong>Booking Number:</strong> ${booking.bookingNo}</p>
        <p><strong>Check-in:</strong> ${new Date(booking.checkIn).toLocaleDateString()}</p>
        <p><strong>Check-out:</strong> ${new Date(booking.checkOut).toLocaleDateString()}</p>
        <p><strong>Total:</strong> Rs. ${booking.totalCost}</p>
        <p>Thank you for choosing Mahadev Inn!</p>
      `,
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log(`✅ Booking confirmation email sent to ${guestEmail}`);
      return { success: true };
    } catch (error) {
      console.error('❌ Error sending booking confirmation email:', error);
      return { success: false, error: error.message };
    }
  }

  async sendCheckinReminder(booking, guestEmail) {
    const mailOptions = {
      from: process.env.SMTP_FROM || 'noreply@mahadevinn.com',
      to: guestEmail,
      subject: `🔔 Check-in Reminder - Mahadev Inn #${booking.bookingNo}`,
      html: `
        <h1>Check-in Reminder</h1>
        <p>Dear ${booking.agentName},</p>
        <p>This is a reminder that your check-in is tomorrow.</p>
        <p><strong>Booking Number:</strong> ${booking.bookingNo}</p>
        <p><strong>Check-in Date:</strong> ${new Date(booking.checkIn).toLocaleDateString()}</p>
        <p>We look forward to welcoming you!</p>
      `,
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log(`✅ Check-in reminder email sent to ${guestEmail}`);
      return { success: true };
    } catch (error) {
      console.error('❌ Error sending check-in reminder:', error);
      return { success: false, error: error.message };
    }
  }

  async sendCheckinDayNotification(booking, guestEmail) {
    const mailOptions = {
      from: process.env.SMTP_FROM || 'noreply@mahadevinn.com',
      to: guestEmail,
      subject: `🏨 Check-in TODAY - Mahadev Inn #${booking.bookingNo}`,
      html: `
        <h1>Check-in Today!</h1>
        <p>Dear ${booking.agentName},</p>
        <p>Your check-in at Mahadev Inn is TODAY!</p>
        <p><strong>Booking Number:</strong> ${booking.bookingNo}</p>
        <p><strong>Check-in Date:</strong> ${new Date(booking.checkIn).toLocaleDateString()}</p>
        <p>Please proceed to the reception.</p>
      `,
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log(`✅ Check-in day notification sent to ${guestEmail}`);
      return { success: true };
    } catch (error) {
      console.error('❌ Error sending check-in day notification:', error);
      return { success: false, error: error.message };
    }
  }

  async sendCheckoutReminder(booking, guestEmail, daysLeft) {
    const mailOptions = {
      from: process.env.SMTP_FROM || 'noreply@mahadevinn.com',
      to: guestEmail,
      subject: `📅 Checkout Reminder - ${daysLeft} day(s) - Mahadev Inn #${booking.bookingNo}`,
      html: `
        <h1>Checkout Reminder</h1>
        <p>Dear ${booking.agentName},</p>
        <p>Your checkout is in ${daysLeft} day(s).</p>
        <p><strong>Booking Number:</strong> ${booking.bookingNo}</p>
        <p><strong>Check-out Date:</strong> ${new Date(booking.checkOut).toLocaleDateString()}</p>
        <p>Please prepare for checkout.</p>
      `,
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log(`✅ Checkout reminder (${daysLeft} days) sent to ${guestEmail}`);
      return { success: true };
    } catch (error) {
      console.error('❌ Error sending checkout reminder:', error);
      return { success: false, error: error.message };
    }
  }

  async sendCheckoutDayNotification(booking, guestEmail) {
    const mailOptions = {
      from: process.env.SMTP_FROM || 'noreply@mahadevinn.com',
      to: guestEmail,
      subject: `📤 Checkout TODAY - Mahadev Inn #${booking.bookingNo}`,
      html: `
        <h1>Checkout Today!</h1>
        <p>Dear ${booking.agentName},</p>
        <p>Your checkout at Mahadev Inn is TODAY!</p>
        <p><strong>Booking Number:</strong> ${booking.bookingNo}</p>
        <p><strong>Check-out Date:</strong> ${new Date(booking.checkOut).toLocaleDateString()}</p>
        <p>Please check out by 12:00 PM.</p>
      `,
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log(`✅ Checkout day notification sent to ${guestEmail}`);
      return { success: true };
    } catch (error) {
      console.error('❌ Error sending checkout day notification:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new EmailService();