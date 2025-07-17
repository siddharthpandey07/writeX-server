const express = require("express");
const mongoose = require("mongoose");
const User = require("../models/User");
const Post = require("../models/Post");
const auth = require("../middleware/auth");

const router = express.Router();

router.get("/", auth, async (req, res) => {
  try {
    const users = await User.find({ _id: { $ne: req.user.id } })
      .select("-password")
      .populate("followers", "username avatar")
      .populate("following", "username avatar");

    res.json(users);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/:id", auth, async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    const user = await User.findById(id)
      .select("-password")
      .populate("followers", "username avatar")
      .populate("following", "username avatar");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const posts = await Post.find({ author: id })
      .populate("author", "username avatar")
      .populate("comments.user", "username avatar")
      .sort({ createdAt: -1 });

    res.json({ user, posts });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/:id/follow", auth, async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    const userToFollow = await User.findById(id);
    const currentUser = await User.findById(req.user.id);

    if (!userToFollow) {
      return res.status(404).json({ message: "User not found" });
    }

    if (id === req.user.id.toString()) {
      return res.status(400).json({ message: "You cannot follow yourself" });
    }

    const isFollowing = currentUser.following.includes(id);

    if (isFollowing) {
      currentUser.following = currentUser.following.filter(
        (userId) => userId.toString() !== id
      );
      userToFollow.followers = userToFollow.followers.filter(
        (userId) => userId.toString() !== req.user.id.toString()
      );
    } else {
      currentUser.following.push(id);
      userToFollow.followers.push(req.user.id);
    }

    await currentUser.save();
    await userToFollow.save();

    res.json({
      message: isFollowing ? "Unfollowed successfully" : "Followed successfully",
      isFollowing: !isFollowing,
      followersCount: userToFollow.followers.length,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

router.put("/profile", auth, async (req, res) => {
  try {
    const { bio, avatar, username } = req.body;

    if (!bio && !avatar && !username) {
      return res.status(400).json({ message: "No fields to update" });
    }

    if (username) {
      const existingUser = await User.findOne({ username });
      if (existingUser && existingUser._id.toString() !== req.user.id) {
        return res.status(400).json({ message: "Username already taken" });
      }
    }

    const updateFields = {};
    if (bio) updateFields.bio = bio;
    if (avatar) updateFields.avatar = avatar;
    if (username) updateFields.username = username;

    const user = await User.findByIdAndUpdate(
      req.user.id,
      updateFields,
      { new: true }
    ).select("-password");

    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/search/:query", auth, async (req, res) => {
  try {
    const { query } = req.params;

    if (!query || query.trim().length < 2) {
      return res.status(400).json({ message: "Search query must be at least 2 characters" });
    }

    const users = await User.find({
      username: { $regex: query, $options: "i" },
      _id: { $ne: req.user.id }
    })
      .select("-password")
      .limit(10);

    res.json(users);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/me/follow", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select("followers following")
      .populate("followers", "username avatar")
      .populate("following", "username avatar");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json({
      followers: user.followers,
      following: user.following,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;