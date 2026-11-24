import mongoose, { Schema } from "mongoose";

const userSchema = new Schema(
    {
        name: { type: String, required: true, trim: true, maxlength: 60 },
        username: { type: String, required: true, unique: true, trim: true, lowercase: true, maxlength: 30 },
        password: { type: String, required: true },
        tokenHash: { type: String, index: true },
        tokenExpires: { type: Date },
    },
    { timestamps: true }
);

const User = mongoose.model("User", userSchema);

export { User };
