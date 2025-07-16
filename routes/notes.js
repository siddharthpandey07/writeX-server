const express = require("express")
const { body, validationResult } = require("express-validator")
const Note = require("../models/Note")
const auth = require("../middleware/auth")

const router = express.Router()

// @route   GET /api/notes
// @desc    Get user's notes
// @access  Private
router.get("/", auth, async (req, res) => {
  try {
    const notes = await Note.find({ user: req.user.id }).sort({ isPinned: -1, createdAt: -1 })

    res.json(notes)
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: "Server error" })
  }
})

// @route   POST /api/notes
// @desc    Create a note
// @access  Private
router.post(
  "/",
  [
    auth,
    body("title").notEmpty().withMessage("Title is required"),
    body("content").notEmpty().withMessage("Content is required"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() })
      }

      const { title, content, tags, isPinned } = req.body

      const note = new Note({
        user: req.user.id,
        title,
        content,
        tags: tags || [],
        isPinned: isPinned || false,
      })

      await note.save()
      res.status(201).json(note)
    } catch (error) {
      console.error(error)
      res.status(500).json({ message: "Server error" })
    }
  },
)

// @route   PUT /api/notes/:id
// @desc    Update a note
// @access  Private
router.put(
  "/:id",
  [
    auth,
    body("title").notEmpty().withMessage("Title is required"),
    body("content").notEmpty().withMessage("Content is required"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() })
      }

      const note = await Note.findById(req.params.id)

      if (!note) {
        return res.status(404).json({ message: "Note not found" })
      }

      // Check if user owns the note
      if (note.user.toString() !== req.user.id.toString()) {
        return res.status(403).json({ message: "Not authorized" })
      }

      const { title, content, tags, isPinned } = req.body

      note.title = title
      note.content = content
      note.tags = tags || []
      note.isPinned = isPinned !== undefined ? isPinned : note.isPinned

      await note.save()
      res.json(note)
    } catch (error) {
      console.error(error)
      res.status(500).json({ message: "Server error" })
    }
  },
)

// @route   DELETE /api/notes/:id
// @desc    Delete a note
// @access  Private
router.delete("/:id", auth, async (req, res) => {
  try {
    const note = await Note.findById(req.params.id)

    if (!note) {
      return res.status(404).json({ message: "Note not found" })
    }

    // Check if user owns the note
    if (note.user.toString() !== req.user.id.toString()) {
      return res.status(403).json({ message: "Not authorized" })
    }

    await Note.findByIdAndDelete(req.params.id)
    res.json({ message: "Note deleted successfully" })
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: "Server error" })
  }
})

module.exports = router
