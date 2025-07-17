const express = require("express");
const { body, validationResult } = require("express-validator");
const mongoose = require("mongoose");
const Post = require("../models/Post");
const User = require("../models/User");
const auth = require("../middleware/auth");

const router = express.Router();

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

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

router.put(
  "/:id",
  [auth, body("content").notEmpty().withMessage("Content is required")],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      if (!isValidObjectId(req.params.id)) {
        return res.status(400).json({ message: "Invalid post ID" });
      }

      const post = await Post.findById(req.params.id);

      if (!post) {
        return res.status(404).json({ message: "Post not found" });
      }

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

router.delete("/:id", auth, async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid post ID" });
    }

    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

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

router.post("/:id/like", auth, async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid post ID" });
    }

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
      post.likes.splice(likeIndex, 1);
    } else {
      post.likes.push({ user: req.user._id });
    }

    await post.save();
    res.json(post);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

router.post(
  "/:id/comment",
  [auth, body("content").notEmpty().withMessage("Comment content is required")],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      if (!isValidObjectId(req.params.id)) {
        return res.status(400).json({ message: "Invalid post ID" });
      }

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

router.delete("/:postId/comments/:commentId", auth, async (req, res) => {
  try {
    if (!isValidObjectId(req.params.postId) || !isValidObjectId(req.params.commentId)) {
      return res.status(400).json({ message: "Invalid ID format" });
    }

    if (!req.user?._id) {
      return res.status(401).json({ message: "User not authenticated" });
    }

    const post = await Post.findById(req.params.postId);
    if (!post) return res.status(404).json({ message: "Post not found" });

    const commentIndex = post.comments.findIndex(
      (c) => c._id.toString() === req.params.commentId
    );

    if (commentIndex === -1) {
      return res.status(404).json({ message: "Comment not found" });
    }

    if (post.comments[commentIndex].user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Not authorized to delete this comment" });
    }

    post.comments.splice(commentIndex, 1);
    await post.save();
    res.json({ message: "Comment deleted" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;