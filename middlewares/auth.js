import jwt from "jsonwebtoken";

const auth = (req, res, next) => {
    const token = req.cookies.token;

    if (!token) {
        return res.status(401).json({ message: "Unauthorized" });
    }

    try {
        const verified = jwt.verify(token, process.env.JWT_SECRET);
        req.user = verified;
        next();
    } catch (error) {
        console.error("Error in auth middleware:", error.message);
        return res.status(401).json({ message: "Unauthorized" });
    }
}

export default auth