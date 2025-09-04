const express = require("express");
const session = require("express-session");
const bodyParser = require("body-parser");
const sqlite3 = require("sqlite3");
const sqlite = require("sqlite"); // beda sama sqlite3, ini wrapper
const mkdirp = require("mkdirp");
const sharp = require("sharp");
const path = require("path");
const fs = require("fs");
const bcrypt = require("bcrypt");

const app = express();
const PORT = 3000;
const ejs = require("ejs");

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
let db;
(async () => {
  db = await sqlite.open({
    filename: "./cms.db",
    driver: sqlite3.Database,
  });

  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE,
      password TEXT
    );
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT,
      content TEXT,
      slug TEXT UNIQUE,
      thumbnail TEXT,        -- URL atau nama file gambar utama
      categories TEXT,       -- simpan kategori (dipisahkan koma)
      tags TEXT,             -- simpan tag (dipisahkan koma)
      meta_title TEXT,       -- SEO title opsional
      meta_description TEXT, -- SEO description opsional
      meta_keywords TEXT,    -- SEO keywords (dipisahkan koma)
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // insert default admin
  const admin = await db.get("SELECT * FROM users WHERE username = ?", [
    "admin",
  ]);
  if (!admin) {
    const hashedPassword = await bcrypt.hash("password", 10);
    await db.run("INSERT INTO users (username, password) VALUES (?, ?)", [
      "admin",
      hashedPassword,
    ]);
  }
})();

// --- Auth Middleware ---
function requireLogin(req, res, next) {
  if (!req.session.user) {
    return res.redirect("/admin-cms/login");
  }
  next();
}

// --- Routes ---
app.get("/admin-cms/login", (req, res) => {
  res.render("login");
});

app.post("/admin-cms/login", async (req, res) => {
  const { username, password } = req.body;
  const user = await db.get("SELECT * FROM users WHERE username = ?", [
    username,
  ]);
  if (user && (await bcrypt.compare(password, user.password))) {
    req.session.user = user;
    return res.redirect("/admin-cms/posts");
  }
  res.render("login", { error: "Invalid credentials" });
});

app.get("/admin-cms/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/admin-cms/login");
  });
});

// --- Posts CRUD ---
// const releaseDir = path.join(__dirname, "release");
// mkdirp.sync(releaseDir); // pastikan folder release ada

// Endpoint generate HTML statis per post
app.get("/admin-cms/posts/rilis/:id", requireLogin, async (req, res) => {
  const postId = req.params.id;

  // Ambil artikel utama
  const post = await db.get("SELECT * FROM posts WHERE id = ?", [postId]);
  if (!post) return res.status(404).send("Post not found");

  // Ambil artikel sebelum dan sesudah
  const previous = await db.all(
    "SELECT * FROM posts WHERE created_at < ? ORDER BY created_at DESC LIMIT 1",
    [post.created_at]
  );
  const next = await db.all(
    "SELECT * FROM posts WHERE created_at > ? ORDER BY created_at ASC LIMIT 1",
    [post.created_at]
  );

  // Gabungkan dan batasi maksimal 2 artikel
  let relatedArticles = [...previous, ...next];
  if (relatedArticles.length > 2) relatedArticles = relatedArticles.slice(0, 2);

  const ejs = require("ejs");
  const templatePath = path.join(__dirname, "views", "static_template.ejs");

  // Render HTML
  const html = await ejs.renderFile(templatePath, {
    title: post.title,
    created_at: post.created_at,
    content: post.content,
    article: post,
    previousArticles: relatedArticles,
    meta_title: post.meta_title,
    meta_description: post.meta_description,
    meta_keywords: post.meta_keywords,
    baseUrl: `${req.protocol}://${req.get("host")}`,
  });

  // Simpan langsung di root /
  const filePath = path.join(__dirname, `${post.slug}.html`);
  fs.writeFileSync(filePath, html);

  res.send(
    `Post "${post.title}" berhasil dirilis! <a href="/${post.slug}.html">Lihat</a>`
  );
});

// Static folder release supaya bisa diakses
// app.use("/release", express.static(releaseDir));

app.get("/admin-cms/posts", requireLogin, async (req, res) => {
  const posts = await db.all("SELECT * FROM posts ORDER BY created_at DESC");
  res.render("posts", { posts });
});

app.get("/admin-cms/posts/new", requireLogin, (req, res) => {
  res.render("new_post");
});

function slugify(title) {
  let baseSlug = title
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[\s\W-]+/g, "-") // ganti spasi & karakter non-alfanumerik dengan '-'
    .replace(/^-+|-+$/g, ""); // hapus '-' di awal/akhir
  return baseSlug;
}

// cek keunikan slug
async function generateUniqueSlug(title) {
  let slug = slugify(title);
  let suffix = 1;
  while (await db.get("SELECT id FROM posts WHERE slug = ?", [slug])) {
    slug = slugify(title) + "-" + suffix;
    suffix++;
  }
  return slug;
}

// CREATE POST
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

  await db.run(
    `INSERT INTO posts 
      (title, content, slug, thumbnail, categories, tags, meta_title, meta_description, meta_keywords) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      title,
      content,
      slug,
      thumbnail,
      categories,
      tags,
      meta_title,
      meta_description,
      meta_keywords,
    ]
  );

  res.redirect("/admin-cms/posts");
});

app.get("/admin-cms/make-sitemap", requireLogin, async (req, res) => {
  const posts = await db.all("SELECT slug, created_at FROM posts");
  let sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  sitemap += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

  // Homepage
  sitemap += `<url><loc>${req.protocol}://${req.get("host")}/</loc></url>\n`;

  // All posts
  posts.forEach((post) => {
    sitemap += `<url>
    <loc>${req.protocol}://${req.get("host")}/${post.slug}.html</loc>
    <lastmod>${new Date(post.created_at).toISOString()}</lastmod>
  </url>\n`;
  });

  sitemap += `</urlset>`;

  // Simpan di root
  fs.writeFileSync(path.join(__dirname, "sitemap.xml"), sitemap);
});

// UPDATE POST
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

  const post = await db.get("SELECT * FROM posts WHERE id = ?", [
    req.params.id,
  ]);

  let slug = post.slug;
  if (post.title !== title) {
    slug = await generateUniqueSlug(title);
  }

  await db.run(
    `UPDATE posts 
     SET title = ?, content = ?, slug = ?, thumbnail = ?, categories = ?, tags = ?, 
         meta_title = ?, meta_description = ?, meta_keywords = ? 
     WHERE id = ?`,
    [
      title,
      content,
      slug,
      thumbnail,
      categories,
      tags,
      meta_title,
      meta_description,
      meta_keywords,
      req.params.id,
    ]
  );

  res.redirect("/admin-cms/posts");
});

app.get("/admin-cms/posts/edit/:id", requireLogin, async (req, res) => {
  const post = await db.get("SELECT * FROM posts WHERE id = ?", [
    req.params.id,
  ]);
  res.render("edit_post", { post });
});

app.get("/admin-cms/posts/delete/:id", requireLogin, async (req, res) => {
  await db.run("DELETE FROM posts WHERE id = ?", [req.params.id]);
  res.redirect("/admin-cms/posts");
});

// --- Quill Image Upload ---
mkdirp.sync("uploads");
const multer = require("multer");
const upload = multer();
// --- Image Manager CRUD ---
// List gambar
app.get("/admin-cms/images", requireLogin, (req, res) => {
  const uploadDir = path.join(__dirname, "uploads");
  fs.readdir(uploadDir, (err, files) => {
    if (err) return res.status(500).send("Gagal membaca folder upload");

    // filter hanya file gambar
    const images = files
      .filter((f) => /\.(jpg|jpeg|png|webp|gif)$/i.test(f))
      .map((f) => ({
        name: f,
        url: `/uploads/${f}`,
      }));

    res.render("images", { images });
  });
});

// Upload gambar
app.post(
  "/admin-cms/images/upload",
  requireLogin,
  upload.single("image"),
  async (req, res) => {
    try {
      const filename = `img_${Date.now()}.webp`;
      const filepath = path.join("uploads", filename);

      await sharp(req.file.buffer)
        .resize(1200) // maksimal lebar
        .webp({ quality: 80 })
        .toFile(filepath);

      res.redirect("/admin-cms/images");
    } catch (err) {
      console.error("Upload error:", err);
      res.status(500).send("Upload gagal");
    }
  }
);

// Hapus gambar
app.get("/admin-cms/images/delete/:name", requireLogin, (req, res) => {
  const filepath = path.join(__dirname, "uploads", req.params.name);
  fs.unlink(filepath, (err) => {
    if (err) console.error("Delete error:", err);
    res.redirect("/admin-cms/images");
  });
});

// List files di folder uploads
app.get("/admin-cms/image-manager", requireLogin, (req, res) => {
  const uploadDir = path.join(__dirname, "uploads");
  fs.readdir(uploadDir, (err, files) => {
    if (err) return res.status(500).json({ error: "Gagal baca folder" });
    // filter hanya gambar
    const images = files.filter((f) => /\.(jpg|jpeg|png|webp|gif)$/i.test(f));
    res.json(images);
  });
});

// Generate semua post + homepage
app.get("/admin-cms/rilis-index", requireLogin, async (req, res) => {
  const posts = await db.all("SELECT * FROM posts ORDER BY created_at DESC");

  // generate semua post
  // for (const post of posts) {
  //   const templatePath = path.join(__dirname, "views", "static_template.ejs");
  //   const html = await ejs.renderFile(templatePath, {
  //     title: post.title,
  //     created_at: post.created_at,
  //     content: post.content,
  //   });
  //   fs.writeFileSync(path.join(releaseDir, `${post.slug}.html`), html);
  // }

  // generate homepage
  const featuredArticles = posts.filter((p) => p.featured);
  const latestArticles = posts.slice(0, 5);
  const homepageTemplate = path.join(__dirname, "views", "index_template.ejs");
  const indexHtml = await ejs.renderFile(homepageTemplate, {
    featuredArticles,
    latestArticles,
    baseUrl: `${req.protocol}://${req.get("host")}`,
  });
  fs.writeFileSync(path.join(__dirname, "index.html"), indexHtml);

  res.send("Semua halaman berhasil dirilis!");
});

// Search page
app.get("/search/:query", async (req, res) => {
  const query = req.params.query.toLowerCase();
  const posts = await db.all("SELECT * FROM posts ORDER BY created_at DESC");

  // filter post sesuai query
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

// --- Start Server ---
app.listen(PORT, () => {
  console.log(`CMS running at http://localhost:${PORT}/admin-cms/login`);
});
