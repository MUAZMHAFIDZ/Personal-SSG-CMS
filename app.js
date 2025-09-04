const express = require("express");
const session = require("express-session");
const bodyParser = require("body-parser");
const mkdirp = require("mkdirp");
const sharp = require("sharp");
const path = require("path");
const fs = require("fs");
const bcrypt = require("bcryptjs");
const { Sequelize, DataTypes, Op } = require("sequelize");
const multer = require("multer");
const ejs = require("ejs");

const app = express();
const PORT = 3000;

// --- Setup EJS ---
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// --- Middleware ---
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static("public"));
app.use("/uploads", express.static("uploads"));

app.use(
  session({
    secret: "supersecretkey",
    resave: false,
    saveUninitialized: true,
    cookie: { httpOnly: true, maxAge: 1000 * 60 * 60 },
  })
);

// --- Database Setup ---
const sequelize = new Sequelize("cms_db", "root", "", {
  host: "localhost",
  dialect: "mysql",
  logging: false,
});

// --- Models ---
const User = sequelize.define(
  "User",
  {
    username: { type: DataTypes.STRING, unique: true },
    password: DataTypes.STRING,
  },
  { tableName: "users", timestamps: false }
);

const Post = sequelize.define(
  "Post",
  {
    title: DataTypes.STRING,
    content: DataTypes.TEXT,
    slug: { type: DataTypes.STRING, unique: true },
    thumbnail: DataTypes.STRING,
    categories: DataTypes.STRING,
    tags: DataTypes.STRING,
    meta_title: DataTypes.STRING,
    meta_description: DataTypes.STRING,
    meta_keywords: DataTypes.STRING,
    created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    featured: { type: DataTypes.BOOLEAN, defaultValue: false },
  },
  { tableName: "posts", timestamps: false }
);

// --- Initialize DB and default admin ---
(async () => {
  await sequelize.sync();

  const admin = await User.findOne({ where: { username: "admin" } });
  if (!admin) {
    const hashedPassword = await bcrypt.hash("password", 10);
    await User.create({ username: "admin", password: hashedPassword });
  }
})();

// --- Auth Middleware ---
function requireLogin(req, res, next) {
  if (!req.session.user) return res.redirect("/admin-cms/login");
  next();
}

// --- Utility ---
function slugify(title) {
  return title
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[\s\W-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function generateUniqueSlug(title) {
  let slug = slugify(title);
  let suffix = 1;
  while (await Post.findOne({ where: { slug } })) {
    slug = slugify(title) + "-" + suffix;
    suffix++;
  }
  return slug;
}

// --- Routes ---
// Login
app.get("/admin-cms/login", (req, res) => res.render("login"));

app.post("/admin-cms/login", async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ where: { username } });
  if (user && (await bcrypt.compare(password, user.password))) {
    req.session.user = user;
    return res.redirect("/admin-cms/posts");
  }
  res.render("login", { error: "Invalid credentials" });
});

app.get("/admin-cms/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/admin-cms/login"));
});

// List posts
app.get("/admin-cms/posts", requireLogin, async (req, res) => {
  const posts = await Post.findAll({ order: [["created_at", "DESC"]] });
  res.render("posts", { posts });
});

// New post
app.get("/admin-cms/posts/new", requireLogin, (req, res) =>
  res.render("new_post")
);

app.post("/admin-cms/posts", requireLogin, async (req, res) => {
  const {
    title,
    content,
    thumbnail,
    categories,
    tags,
    meta_title,
    meta_description,
    meta_keywords,
  } = req.body;
  const slug = await generateUniqueSlug(title);

  await Post.create({
    title,
    content,
    slug,
    thumbnail,
    categories,
    tags,
    meta_title,
    meta_description,
    meta_keywords,
  });
  res.redirect("/admin-cms/posts");
});

// Edit post
app.get("/admin-cms/posts/edit/:id", requireLogin, async (req, res) => {
  const post = await Post.findByPk(req.params.id);
  res.render("edit_post", { post });
});

app.post("/admin-cms/posts/update/:id", requireLogin, async (req, res) => {
  const {
    title,
    content,
    thumbnail,
    categories,
    tags,
    meta_title,
    meta_description,
    meta_keywords,
  } = req.body;
  const post = await Post.findByPk(req.params.id);

  let slug = post.slug;
  if (post.title !== title) slug = await generateUniqueSlug(title);

  await Post.update(
    {
      title,
      content,
      thumbnail,
      categories,
      tags,
      meta_title,
      meta_description,
      meta_keywords,
      slug,
    },
    { where: { id: req.params.id } }
  );

  res.redirect("/admin-cms/posts");
});

// Delete post
app.get("/admin-cms/posts/delete/:id", requireLogin, async (req, res) => {
  await Post.destroy({ where: { id: req.params.id } });
  res.redirect("/admin-cms/posts");
});

// Generate static HTML per post
app.get("/admin-cms/posts/rilis/:id", requireLogin, async (req, res) => {
  const post = await Post.findByPk(req.params.id);
  if (!post) return res.status(404).send("Post not found");

  const previousArticles = await Post.findAll({
    where: { created_at: { [Op.lt]: post.created_at } },
    order: [["created_at", "DESC"]],
    limit: 1,
  });
  const nextArticles = await Post.findAll({
    where: { created_at: { [Op.gt]: post.created_at } },
    order: [["created_at", "ASC"]],
    limit: 1,
  });

  const relatedArticles = [...previousArticles, ...nextArticles].slice(0, 2);

  const html = await ejs.renderFile(
    path.join(__dirname, "views", "static_template.ejs"),
    {
      title: post.title,
      created_at: post.created_at,
      content: post.content,
      article: post,
      previousArticles: relatedArticles,
      meta_title: post.meta_title,
      meta_description: post.meta_description,
      meta_keywords: post.meta_keywords,
      baseUrl: `${req.protocol}://${req.get("host")}`,
    }
  );

  fs.writeFileSync(path.join(__dirname, `${post.slug}.html`), html);
  res.send(
    `Post "${post.title}" berhasil dirilis! <a href="/${post.slug}.html">Lihat</a>`
  );
});

// Sitemap
app.get("/admin-cms/make-sitemap", requireLogin, async (req, res) => {
  const posts = await Post.findAll();
  let sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;
  sitemap += `<url><loc>${req.protocol}://${req.get("host")}/</loc></url>\n`;

  posts.forEach((post) => {
    sitemap += `<url><loc>${req.protocol}://${req.get("host")}/${
      post.slug
    }.html</loc><lastmod>${new Date(
      post.created_at
    ).toISOString()}</lastmod></url>\n`;
  });

  sitemap += `</urlset>`;
  fs.writeFileSync(path.join(__dirname, "sitemap.xml"), sitemap);
  res.send("Sitemap berhasil dibuat!");
});

// Homepage + rilis semua post
app.get("/admin-cms/rilis-index", requireLogin, async (req, res) => {
  const posts = await Post.findAll({ order: [["created_at", "DESC"]] });

  const featuredArticles = posts.filter((p) => p.featured);
  const latestArticles = posts.slice(0, 5);

  const indexHtml = await ejs.renderFile(
    path.join(__dirname, "views", "index_template.ejs"),
    {
      featuredArticles,
      latestArticles,
      baseUrl: `${req.protocol}://${req.get("host")}`,
    }
  );

  fs.writeFileSync(path.join(__dirname, "index.html"), indexHtml);
  res.send("Semua halaman berhasil dirilis!");
});

// Search
app.get("/search/:query", async (req, res) => {
  const query = req.params.query.toLowerCase();
  const posts = await Post.findAll();

  const results = posts.filter(
    (post) =>
      post.title.toLowerCase().includes(query) ||
      post.content.toLowerCase().includes(query) ||
      (post.tags && post.tags.toLowerCase().includes(query)) ||
      (post.categories && post.categories.toLowerCase().includes(query))
  );

  res.render("search_template", {
    query,
    results,
    baseUrl: `${req.protocol}://${req.get("host")}`,
  });
});

// --- Image Upload ---
mkdirp.sync("uploads");
const upload = multer();

app.get("/admin-cms/images", requireLogin, (req, res) => {
  const files = fs
    .readdirSync(path.join(__dirname, "uploads"))
    .filter((f) => /\.(jpg|jpeg|png|webp|gif)$/i.test(f));
  const images = files.map((f) => ({ name: f, url: `/uploads/${f}` }));
  res.render("images", { images });
});

app.post(
  "/admin-cms/images/upload",
  requireLogin,
  upload.single("image"),
  async (req, res) => {
    try {
      const filename = `img_${Date.now()}.webp`;
      const filepath = path.join("uploads", filename);
      await sharp(req.file.buffer)
        .resize(1200)
        .webp({ quality: 80 })
        .toFile(filepath);
      res.redirect("/admin-cms/images");
    } catch (err) {
      console.error(err);
      res.status(500).send("Upload gagal");
    }
  }
);

app.get("/admin-cms/images/delete/:name", requireLogin, (req, res) => {
  const filepath = path.join(__dirname, "uploads", req.params.name);
  if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
  res.redirect("/admin-cms/images");
});

app.get("/admin-cms/image-manager", requireLogin, (req, res) => {
  const images = fs
    .readdirSync(path.join(__dirname, "uploads"))
    .filter((f) => /\.(jpg|jpeg|png|webp|gif)$/i.test(f));
  res.json(images);
});

// --- Start Server ---
app.listen(PORT, () =>
  console.log(`CMS running at http://localhost:${PORT}/admin-cms/login`)
);
