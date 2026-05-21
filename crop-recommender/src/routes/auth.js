const express = require("express");
const router = express.Router();
const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const crypto = require("crypto");

// Email Transport
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Send email function
async function sendVerificationEmail(email, token) {
  const url = `${process.env.BASE_URL}/auth/verify/${token}`;

  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: email,
    subject: "Verify your CropRec Account",
    html: `
      <h2>Verify Your Email</h2>
      <p>Click the link below to activate your account:</p>
      <a href="${url}" style="padding:10px 20px;background:green;color:white;text-decoration:none;border-radius:5px;">Verify Email</a>
      <p>If button doesn't work, use this link:</p>
      <p>${url}</p>
    `
  });
}

/* -----------------------------------------
   REGISTER
------------------------------------------ */
router.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    let existing = await User.findOne({ email });
    if (existing) return res.json({ error: "Email already registered" });

    const hashed = await bcrypt.hash(password, 10);

    const token = crypto.randomBytes(32).toString("hex");

    const user = await User.create({
      name,
      email,
      password: hashed,
      verificationToken: token,
      verified: false
    });

    // Send email
    await sendVerificationEmail(email, token);

    res.json({
      message: "Registration successful! Please check your email to verify your account."
    });

  } catch (err) {
    res.json({ error: err.message });
  }
});

/* -----------------------------------------
   EMAIL VERIFICATION
------------------------------------------ */
router.get("/verify/:token", async (req, res) => {
  try {
    const user = await User.findOne({ verificationToken: req.params.token });

    if (!user) return res.send("Invalid or expired verification token.");

    user.verified = true;
    user.verificationToken = null;
    await user.save();

    res.send(`
      <h2>Email Verified Successfully 🎉</h2>
      <p>You can now log in to your account.</p>
    `);

  } catch (err) {
    res.send("Server error.");
  }
});

/* -----------------------------------------
   LOGIN
------------------------------------------ */
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.json({ error: "User not found" });

    if (!user.verified)
      return res.json({ error: "Email not verified. Please check your inbox." });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.json({ error: "Incorrect password" });

    // Create JWT
    const token = jwt.sign(
      { id: user._id, email: user.email, name: user.name }, 
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    // Send user object back
    res.json({
      message: "Login successful",
      token: token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email
      }
    });

  } catch (err) {
    res.json({ error: err.message });
  }
});


module.exports = router;
