const express = require('express');
const multer = require('multer');  // For handling file uploads
const AdmZip = require('adm-zip');  // For unzipping files
const marked = require('marked');  // For markdown processing
const path = require('path');
const fs = require('fs');
const cookieParser = require('cookie-parser');
const config = require('./config.json');
const https = require('https');
const http = require('http');
const { execSync } = require('child_process');

if (config.https) {
    if (!fs.existsSync(path.join(__dirname, 'openssl', 'private.key')) || !fs.existsSync(path.join(__dirname, 'openssl', 'cert.pem'))) {
        fs.mkdirSync('openssl', { recursive: true });
        execSync('openssl req -x509 -newkey rsa:4096 -keyout openssl/private.pem -out openssl/cert.pem -sha256 -days 3650 -nodes -subj "/C=UK/ST=ENG/L=Shitterton/O=My Butt/OU=My Butt hole/CN=The Shitter"')
    }
    
    var privateKey  = fs.readFileSync('openssl/private.pem', 'utf8');
    var certificate = fs.readFileSync('openssl/cert.pem', 'utf8');

    var credentials = {key: privateKey, cert: certificate};

}

const app = express();
const port = config.port;

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
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Set up posts storage
const postsFile = path.join(__dirname, 'data', 'posts.json');

// Make sure the data directory exists
fs.mkdirSync(path.join(__dirname, 'data'), { recursive: true });

// Initialize posts file if it doesn't exist
if (!fs.existsSync(postsFile)) {
    fs.writeFileSync(postsFile, JSON.stringify([]));
}

let validSessions = [];

// Routes
app.get('/', (req, res) => {
    if (!checkSession(req.cookies.sessionToken)) { res.redirect('/login'); return;}
    // List available blog posts
    res.render('index', { posts: getPosts() });
});

app.get('/favicon.ico', (req, res) => {
    const faviconPath = path.join(__dirname, 'public', 'favicon.ico');
    res.sendFile(faviconPath);
});


app.post('/upload', upload.single('zipfile'), (req, res) => {
    if (!checkSession(req.cookies.sessionToken)) { res.redirect('/login'); return;}
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

//uploads an image
app.post('/upload/:id/images', upload.single('image'), (req, res) => {
    if (!checkSession(req.cookies.sessionToken)) { res.redirect('/login'); return;}
    if (!req.file) {
        return res.status(400).render('error', 'No file uploaded');
    }

    try {
        const postId = req.params.id;
        const originalname = req.file.originalname;
        const tempPath = req.file.path; // current location: uploads/filename
        const targetDir = path.join(__dirname, 'public', 'posts', postId, 'images');
        const targetPath = path.join(targetDir, originalname);

        // Create the destination directory if it doesn't exist
        fs.mkdirSync(targetDir, { recursive: true });

        // Move the file from tempPath to targetPath
        fs.rename(tempPath, targetPath, (err) => {
            if (err) {
                return res.status(500).render('error', { message: 'Error moving file: ' + err.message });
            }
            
            res.status(200).send('File uploaded and moved successfully!');
        });
    } catch (error) {
        res.status(500).render('error', { message: 'Error processing upload: ' + error.message });
    }
});

app.get('/post/:id', (req, res) => {
    if (!checkSession(req.cookies.sessionToken)) { res.redirect('/login'); return;}
    const postId = req.params.id;
    const post = getPostById(postId);

    if (!post) {
        return res.status(404).render('404', { message: 'Post not found' });
    }

    res.render('post', { post });
});

app.get('/post/:id/images/:imageName', (req, res) => {
    if (!checkSession(req.cookies.sessionToken)) { res.redirect('/login'); return;}
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
        //console.error('Error sending image:', error);
        res.status(500).render('error', { message: 'Error sending image' });
    }
    
});

//edit post
app.post('/edit/:id', (req, res) => {
    if (!checkSession(req.cookies.sessionToken)) { res.redirect('/login'); return;}
    const content = req.body.content;
    const postId = req.params.id;
    const post = getPostById(postId);

    if (!post) {
        return res.status(404).render('404', { message: 'Post not found' });
    }

    // Save the updated content to the README.md file
    const readmePath = path.join(__dirname, 'public/posts', postId, 'README.md');
    
    fs.writeFileSync(readmePath, content);
    // Update the HTML content in posts.json
    addToPostsDB(postId, content);

    res.status(200).redirect('/post/' + postId);
    
});

app.get('/edit/:id', (req, res) => {
    if (!checkSession(req.cookies.sessionToken)) { res.redirect('/login'); return;}
    const postId = req.params.id;
    const post = getPostById(postId);
    var content = fs.readFileSync(path.join(__dirname, 'public/posts', postId, 'README.md'), 'utf8');

    if (!post) {
        return res.status(404).render('404', { message: 'Post not found' });
    }

    
    res.render('edit', { post, content });
}); 

//returns the image
app.get('/edit/:id/images/:imageName', (req, res) => {
    if (!checkSession(req.cookies.sessionToken)) { res.redirect('/login'); return;}
    const postId = req.params.id;
    const post = getPostById(postId);
    const imageName = req.params.imageName;

    if (!post) {
        return res.status(404).render('404', { message: 'Post not found'});
    }

    try {
        const imagePath = path.join(__dirname, 'public/posts', postId, 'images', imageName);
        res.sendFile(imagePath);
    } catch (error) {
        console.error('Error sending image:', error);
        res.status(500).render('error', { message: 'Error sending image' });
    }
});

//returns a list of all images in the post images directory
app.get('/edit/:id/images', (req, res) => {
    if (!checkSession(req.cookies.sessionToken)) { res.redirect('/login'); return;}
    const postId = req.params.id;
    const post = getPostById(postId);

    if (!post) {
        return res.status(404).render('404', { message: 'Post not found'});
    }

    try {
        const imagesDir = path.join(__dirname, 'public/posts', postId, 'images');
        const images = fs.readdirSync(imagesDir);
        res.status(200).json(images);
    } catch (error) {
        console.error('Error reading images directory:', error);
        res.status(500).render('error', { message: 'Error reading images directory' });
    }
});

app.get('/create', (req, res) => { 
    if (!checkSession(req.cookies.sessionToken)) { res.redirect('/login'); return;}
    fs.copyFile(path.join(__dirname, 'templates', 'default-template.zip'), path.join(__dirname, 'uploads', 'default-template.zip'), (err) => {
        if (err) {
            console.error('Error copying template:', err);
            return res.status(500).render('error', { message: 'Error copying template' });
        }
    });

    let post = processUploadedZip(path.join(__dirname, 'uploads', 'default-template.zip'));
    res.redirect('/edit/' + post.id);

});


//deletes an image
app.delete('/edit/:id/images/:imageName', (req, res) => { 
    if (!checkSession(req.cookies.sessionToken)) { res.redirect('/login'); return;}
    const postId = req.params.id;
    const post = getPostById(postId);
    const imageName = req.params.imageName;

    if (!post) {
        return res.status(404).render('404', { message: 'Post not found'});
    }

    try {
        const imagePath = path.join(__dirname, 'public/posts', postId, 'images', imageName);
        fs.rmSync(imagePath);
        res.status(200).send('Image deleted successfully');
    } catch (error) {
        console.error('Error deleting image:', error);
        res.status(500).render('error', { message: 'Error deleting image' });
    }
});

app.get('/login', (req, res) => {
    res.render('login');
});

app.post('/login', (req, res) => {
    const username = req.body.username;
    const password = req.body.password;

    
    if (username === config.username && password === config.password) { 
        // Generate a random session token
        const sessionToken = require('crypto').randomBytes(64).toString('hex');
        
        
        // Store session token in cookie
        res.cookie('sessionToken', sessionToken, {
            httpOnly: true,
            secure: config.https,
            maxAge: 24 * 60 * 60 * 1000 // 24 hours
        });
        
        validSessions.push(sessionToken);
        
        // Redirect to home page
        res.redirect('/');
    } else {
        res.render('login', { message: 'Invalid credentials' });
    }
});


app.delete('/post/:id', (req, res) => {
    if (!checkSession(req.cookies.sessionToken)) { res.redirect('/login'); return;}
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
    removeFromPostsDB(postId);
    res.status(200).send('Post deleted successfully');
});


app.all('*', (req, res) => {
    if (!checkSession(req.cookies.sessionToken)) { res.redirect('/login'); return;}
    res.status(404).render('404', { message: 'Page not found' });
});



if (config.https) {
    var httpsServer = https.createServer(credentials, app);
    httpsServer.listen(port);
    console.log('server listening on https://localhost:' + port + '/');
} else {
    var httpServer = http.createServer(app);
    httpServer.listen(port);
    console.log('server listening on http://localhost:' + port + '/');
}

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

function replaceImagePathsWithCorrectPaths(htmlContent, postId) {
    const imgDir = path.join(__dirname, 'public/posts', postId, 'images');
    const imgFiles = fs.readdirSync(imgDir);

    imgFiles.forEach(file => {
        const regex = new RegExp(`src="images/${file}"`, 'g');
        htmlContent = htmlContent.replace(regex, `src="/post/${postId}/images/${file}"`);
    });

    return htmlContent;
}

//add to posts.json
function addToPostsDB(postId, mdContent) {
    const posts = getPosts();
    let post = posts.find(p => p.id === postId);
    const htmlContent = replaceImagePathsWithCorrectPaths(marked.parse(mdContent), postId);

    const metadata = {
        id: postId,
        title: getTitle(mdContent) || 'Untitled Post',
        date: new Date().toISOString(),
        contentPath: path.join('posts', postId, 'README.md'),
        htmlContent
    };

    if (post) {
        post.id = metadata.id;
        post.title = metadata.title;
        post.date = metadata.date;
        post.contentPath = metadata.contentPath;
        post.htmlContent = metadata.htmlContent;
        fs.writeFileSync(postsFile, JSON.stringify(posts, null, 2));
    }
}

/*
USE:
if (!checkSession(req.cookies.sessionToken)) { res.redirect('/login'); return;}
*/
function checkSession(sessionToken) {
    if (validSessions.includes(sessionToken)) {
        return true;
    }
    
    return false;
}


// Remove from posts.json
function removeFromPostsDB(postId) {
    let posts = getPosts();
    posts = posts.filter(p => p.id !== postId);
    fs.writeFileSync(postsFile, JSON.stringify(posts, null, 2));
} 