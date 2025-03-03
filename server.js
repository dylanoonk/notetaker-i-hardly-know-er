const express = require('express');
const multer = require('multer');  // For handling file uploads
const AdmZip = require('adm-zip');  // For unzipping files
const marked = require('marked');  // For markdown processing
const path = require('path');
const fs = require('fs');
const { message } = require('statuses');

const app = express();
const port = 3000;

// Set up storage for uploaded files
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage });

// Make sure uploads directory exists
fs.mkdirSync('uploads', { recursive: true });

// Set up templating engine
app.set('view engine', 'ejs');
app.use(express.static('public'));

// Set up posts storage
const postsFile = path.join(__dirname, 'data', 'posts.json');

// Make sure the data directory exists
fs.mkdirSync(path.join(__dirname, 'data'), { recursive: true });

// Initialize posts file if it doesn't exist
if (!fs.existsSync(postsFile)) {
    fs.writeFileSync(postsFile, JSON.stringify([]));
}

// Routes
app.get('/', (req, res) => {
    // List available blog posts
    res.render('index', { posts: getPosts() });
});

app.post('/upload', upload.single('zipfile'), (req, res) => {
    if (!req.file) {
        return res.status(400).send('No file uploaded');
    }

    try {
        // Process the uploaded zip file
        processUploadedZip(req.file.path);
        res.redirect('/');
    } catch (error) {
        res.status(500).render('error', { message: 'Error processing upload: ' + error.message });
    }
});

app.get('/post/:id', (req, res) => {
    const postId = req.params.id;
    const post = getPostById(postId);

    if (!post) {
        return res.status(404).render('404', { message: 'Post not found' });
    }

    res.render('post', { post });
});

app.get('/post/:id/images/:imageName', (req, res) => {
    console.log('Fetching image for post:', req.params.id, 'Image:', req.params.imageName);
    const postId = req.params.id;
    const imageName = req.params.imageName;
    const post = getPostById(postId);

    if (!post) {
        return res.status(404).render('404', { message: 'Post not found' });
    }

    try {
        const imagePath = path.join(__dirname, 'public/posts', postId, 'images', imageName);
        res.sendFile(imagePath);
    } catch (error) {
        console.error('Error sending image:', error);
        res.status(500).render('error', { message: 'Error sending image' });
    }
    
});

app.get('/edit/:id', (req, res) => {
    const postId = req.params.id;
    const post = getPostById(postId);
    var content = fs.readFileSync(path.join(__dirname, 'public/posts', postId, 'README.md'), 'utf8');

    if (!post) {
        return res.status(404).render('404', { message: 'Post not found' });
    }

    content = content.replace('/[\r\n]/gm', '\\n');
    content = content.replace('\n', '\\n');
    res.render('edit', { post, content });
});

app.get('/delete/:id', (req, res) => {
    const postId = req.params.id;
    const post = getPostById(postId);

    if (!post) {
        return res.status(404).render('404', { message: 'Post not found' });
    }
    // Delete the post directory
    const postDir = path.join(__dirname, 'public/posts', postId);
    try {
        fs.rmSync(postDir, { recursive: true });
    } catch (error) {
        console.error('Error deleting post directory:', error);
        return res.status(500).render('error', { message: 'Error deleting post directory' });
    }
    // Remove from posts.json
    let posts = getPosts();
    posts = posts.filter(p => p.id !== postId);
    fs.writeFileSync(postsFile, JSON.stringify(posts, null, 2));
    res.redirect('/');
});


app.all('*', (req, res) => {
    res.status(404).render('404', { message: 'Page not found' });
});



// Start the server
app.listen(port, () => {
    console.log(`Blog server running at http://localhost:${port}`);
});

// Helper functions
function processUploadedZip(zipPath, allowedDirs = ['images']) {
    try {
        console.log('Processing uploaded zip:', zipPath);
        // Generate a unique post ID and create a dedicated folder
        const postId = Date.now().toString();
        const extractPath = path.join(__dirname, 'public/posts', postId);
        fs.mkdirSync(extractPath, { recursive: true });

        const allowedDirectories = new Set(allowedDirs);
        const zip = new AdmZip(zipPath);
        let zipEntries = zip.getEntries();

        // Filter out __MACOSX entries
        zipEntries = zipEntries.filter(entry => !entry.entryName.startsWith('__MACOSX'));

        // Detect a common prefix if the ZIP wraps everything in a folder
        let commonPrefix = null;
        if (zipEntries.length > 0) {
            const firstEntryPrefix = zipEntries[0].entryName.split('/')[0];
            commonPrefix = firstEntryPrefix;
            for (const entry of zipEntries) {
                const parts = entry.entryName.split('/');
                if (parts[0] !== commonPrefix) {
                    commonPrefix = null;
                    break;
                }
            }
        }

        // Extract only allowed files:
        // - Files at the root must be README.md.
        // - Files inside a folder: allow only if the top-level folder is in allowedDirectories.
        for (const entry of zipEntries) {
            let relativePath = entry.entryName;
            if (commonPrefix && relativePath.startsWith(commonPrefix + '/')) {
                relativePath = relativePath.substring(commonPrefix.length + 1);
            }
            const safeRelativePath = path.normalize(relativePath);
            if (safeRelativePath.includes('..')) {
                throw new Error(`Invalid file path detected: ${safeRelativePath}`);
            }

            // Determine if the file should be extracted:
            const parts = safeRelativePath.split(path.sep);
            if (parts.length === 1) {
                // A file at the root: only allow if it's README.md
                if (parts[0] !== 'README.md') continue;
            } else {
                // A file inside a folder: allow only if the top-level folder is allowed.
                if (!allowedDirectories.has(parts[0])) continue;
            }

            // Write the file to the extraction folder.
            const fullPath = path.join(extractPath, safeRelativePath);
            if (entry.isDirectory) {
                fs.mkdirSync(fullPath, { recursive: true });
            } else {
                fs.mkdirSync(path.dirname(fullPath), { recursive: true });
                fs.writeFileSync(fullPath, entry.getData());
            }
        }

        // Look for README.md at the root of the extraction folder
        const mdFilePath = path.join(extractPath, 'README.md');
        if (!fs.existsSync(mdFilePath)) {
            throw new Error('README.md not found in the zip');
        }
        const mdContent = fs.readFileSync(mdFilePath, 'utf8');

        // Process markdown to HTML. The helper function should update image paths as needed.
        const htmlContent = replaceImagePathsWithCorrectPaths(marked.parse(mdContent), postId, 'README.md');

        // Save post metadata (adjust contentPath as needed for your app)
        const metadata = {
            id: postId,
            title: getTitle(mdContent) || 'Untitled Post',
            date: new Date().toISOString(),
            contentPath: path.join('posts', postId, 'README.md'),
            htmlContent
        };

        savePostMetadata(metadata);
        console.log(`Post ${postId} successfully processed!`);

        fs.rmSync(zipPath, { force: true }); // Clean up the uploaded zip file
        return metadata;
    } catch (error) {
        console.error(`Error processing zip: ${error.message}`);
        throw error;
    }
}

function getTitle(markdown) {
    // Extract title from markdown (assuming first heading is title)
    const match = markdown.match(/^# (.*$)/m);
    return match ? match[1] : null;
}

function getPosts() {
    try {
        const data = fs.readFileSync(postsFile, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error reading posts:', error);
        return [];
    }
}

function savePostMetadata(metadata) {
    try {
        const posts = getPosts();
        posts.push(metadata);
        fs.writeFileSync(postsFile, JSON.stringify(posts, null, 2));
    } catch (error) {
        console.error('Error saving post metadata:', error);
        throw error;
    }
}

function getPostById(id) {
    const posts = getPosts();
    return posts.find(post => post.id === id);
}

function replaceImagePathsWithCorrectPaths(htmlContent, postId, folderName) {
    const imgDir = path.join(__dirname, 'public/posts', postId, folderName, '../', 'images');
    const imgFiles = fs.readdirSync(imgDir);

    imgFiles.forEach(file => {
        const regex = new RegExp(`src="images/${file}"`, 'g');
        htmlContent = htmlContent.replace(regex, `src="/post/${postId}/images/${file}"`);
    });

    return htmlContent;
}