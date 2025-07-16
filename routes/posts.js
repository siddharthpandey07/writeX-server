const express = require("express");
const { body, validationResult } = require("express-validator");
const mongoose = require("mongoose");
const Post = require("../models/Post");
const User = require("../models/User");
const auth = require("../middleware/auth");

const router = express.Router();

// Helper function to validate ObjectId
const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

// @route   GET /api/posts
// @desc    Get all posts
// @access  Private
router.get("/", auth, async (req, res) => {
  try {
    const posts = await Post.find()
      .populate("author", "username avatar")
      .populate("comments.user", "username avatar")
      .sort({ createdAt: -1 });

    res.json(posts);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

// @route   POST /api/posts
// @desc    Create a post
// @access  Private
router.post(
  "/",
  [auth, body("content").notEmpty().withMessage("Content is required")],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { content } = req.body;

      // Validate user ID
      if (!req.user?._id) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const post = new Post({
        author: req.user._id,
        content,
      });

      await post.save();
      await post.populate("author", "username avatar");

      res.status(201).json(post);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Server error" });
    }
  }
);

// @route   PUT /api/posts/:id
// @desc    Update a post
// @access  Private
router.put(
  "/:id",
  [auth, body("content").notEmpty().withMessage("Content is required")],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      // Validate post ID
      if (!isValidObjectId(req.params.id)) {
        return res.status(400).json({ message: "Invalid post ID" });
      }

      const post = await Post.findById(req.params.id);

      if (!post) {
        return res.status(404).json({ message: "Post not found" });
      }

      // Validate user ID and ownership
      if (!req.user?._id || post.author.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: "Not authorized" });
      }

      post.content = req.body.content;
      await post.save();
      await post.populate("author", "username avatar");

      res.json(post);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Server error" });
    }
  }
);

// @route   DELETE /api/posts/:id
// @desc    Delete a post
// @access  Private
router.delete("/:id", auth, async (req, res) => {
  try {
    // Validate post ID
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid post ID" });
    }

    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    // Validate user ID and ownership
    if (!req.user?._id || post.author.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Not authorized" });
    }

    await Post.findByIdAndDelete(req.params.id);
    res.json({ message: "Post deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

// @route   POST /api/posts/:id/like
// @desc    Like/Unlike a post
// @access  Private
router.post("/:id/like", auth, async (req, res) => {
  try {
    // Validate post ID
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid post ID" });
    }

    // Validate user ID
    if (!req.user?._id) {
      return res.status(401).json({ message: "User not authenticated" });
    }

    const post = await Post.findById(req.params.id);
    const currentUser = await User.findById(req.user._id);

    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    if (!currentUser) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check if user is following the post author or is a follower
    const postAuthor = await User.findById(post.author);
    if (!postAuthor) {
      return res.status(404).json({ message: "Post author not found" });
    }

    const isFollowingOrFollower =
      currentUser.following.includes(post.author.toString()) ||
      postAuthor.followers.includes(req.user._id.toString()) ||
      post.author.toString() === req.user._id.toString();

    if (!isFollowingOrFollower) {
      return res.status(403).json({
        message: "You must follow this user or be their follower to like their posts",
      });
    }

    const likeIndex = post.likes.findIndex(
      (like) => like.user.toString() === req.user._id.toString()
    );

    if (likeIndex > -1) {
      // Unlike
      post.likes.splice(likeIndex, 1);
    } else {
      // Like
      post.likes.push({ user: req.user._id });
    }

    await post.save();
    res.json(post);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

// @route   POST /api/posts/:id/comment
// @desc    Add comment to post
// @access  Private
router.post(
  "/:id/comment",
  [auth, body("content").notEmpty().withMessage("Comment content is required")],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      // Validate post ID
      if (!isValidObjectId(req.params.id)) {
        return res.status(400).json({ message: "Invalid post ID" });
      }

      // Validate user ID
      if (!req.user?._id) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const post = await Post.findById(req.params.id);
      const currentUser = await User.findById(req.user._id);

      if (!post) {
        return res.status(404).json({ message: "Post not found" });
      }

      if (!currentUser) {
        return res.status(404).json({ message: "User not found" });
      }

      // Check if user is following the post author or is a follower
      const postAuthor = await User.findById(post.author);
      if (!postAuthor) {
        return res.status(404).json({ message: "Post author not found" });
      }

      const isFollowingOrFollower =
        currentUser.following.includes(post.author.toString()) ||
        postAuthor.followers.includes(req.user._id.toString()) ||
        post.author.toString() === req.user._id.toString();

      if (!isFollowingOrFollower) {
        return res.status(403).json({
          message: "You must follow this user or be their follower to comment on their posts",
        });
      }

      const newComment = {
        user: req.user._id,
        content: req.body.content,
      };

      post.comments.push(newComment);
      await post.save();
      await post.populate("comments.user", "username avatar");

      res.json(post);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Server error" });
    }
  }
);

// @route   DELETE /api/posts/:postId/comments/:commentId
// @desc    Delete a comment (only by comment author)
// @access  Private
router.delete("/:postId/comments/:commentId", auth, async (req, res) => {
  try {
    // Validate IDs
    if (!isValidObjectId(req.params.postId) || !isValidObjectId(req.params.commentId)) {
      return res.status(400).json({ message: "Invalid ID format" });
    }

    // Validate user ID
    if (!req.user?._id) {
      return res.status(401).json({ message: "User not authenticated" });
    }

    const post = await Post.findById(req.params.postId);
    if (!post) return res.status(404).json({ message: "Post not found" });

    // Find the comment
    const commentIndex = post.comments.findIndex(
      (c) => c._id.toString() === req.params.commentId
    );

    if (commentIndex === -1) {
      return res.status(404).json({ message: "Comment not found" });
    }

    // Check if user is the comment author
    if (post.comments[commentIndex].user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Not authorized to delete this comment" });
    }

    // Remove the comment
    post.comments.splice(commentIndex, 1);
    await post.save();
    res.json({ message: "Comment deleted" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;