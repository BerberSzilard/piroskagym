
const jwt = require("jsonwebtoken");



function authRequired(req, res, next) {

  const header = req.headers.authorization || "";

  const parts = header.split(" ");



  if (parts.length !== 2 || parts[0] !== "Bearer") {

    return res.status(401).json({ error: "missing_token" });

  }



  try {

    const payload = jwt.verify(parts[1], process.env.JWT_SECRET);



    req.user = {

      id: payload.id,

      email: payload.email,

      name: payload.name,

      role: payload.role || "user",

    };



    next();

  } catch (e) {

    return res.status(401).json({ error: "invalid_token" });

}



}
module.exports = { authRequired };

