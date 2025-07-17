const express = require("express")
const jwt = require("jsonwebtoken")
const { body, validationResult } = require("express-validator")
const User = require("../models/User")
const auth = require("../middleware/auth")

const router = express.Router()

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE,
  })
}

router.post(
  "/register",
  [
    body("username").isLength({ min: 3 }).withMessage("Username must be at least 3 characters"),
    body("email").isEmail().withMessage("Please enter a valid email"),
    body("password").isLength({ min: 6 }).withMessage("Password must be at least 6 characters"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() })
      }

      const { username, email, password } = req.body

      const existingUser = await User.findOne({
        $or: [{ email }, { username }],
      })

      if (existingUser) {
        return res.status(400).json({ message: "User already exists" })
      }

      const user = new User({ username, email, password })
      await user.save()

      const token = generateToken(user._id)

      res.status(201).json({
        token,
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          bio: user.bio,
          avatar: user.avatar,
        },
      })
    } catch (error) {
      console.error(error)
      res.status(500).json({ message: "Server error" })
    }
  },
)

router.post(
  "/login",
  [
    body("email").isEmail().withMessage("Please enter a valid email"),
    body("password").exists().withMessage("Password is required"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() })
      }

      const { email, password } = req.body

      const user = await User.findOne({ email })
      if (!user) {
        return res.status(400).json({ message: "Invalid credentials" })
      }

      const isMatch = await user.comparePassword(password)
      if (!isMatch) {
        return res.status(400).json({ message: "Invalid credentials" })
      }

      const token = generateToken(user._id)

      res.json({
        token,
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          bio: user.bio,
          avatar: user.avatar,
        },
      })
    } catch (error) {
      console.error(error)
      res.status(500).json({ message: "Server error" })
    }
  },
)

router.get("/me", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select("-password")
      .populate("followers", "username avatar")
      .populate("following", "username avatar")

    res.json(user)
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: "Server error" })
  }
})

module.exports = router
