
# Notetaker? I Hardly Know 'Er

Notetaker? I Hardly Know 'Er (NTIHKH) is a lightweight, Markdown-based note-taking webapp built with Node.js, Express, and EJS. It allows you to write, edit, and manage notes with real-time Markdown preview, upload and manage images for your posts, and includes a simple authentication system.

## Features

- **Markdown Editor:** Write your notes in Markdown and see a live preview.
- **Image Uploads & Management:** Upload images to your posts and manage them via a sidebar interface.
- **Post Management:** Create, edit, and delete posts with ease.
- **User Authentication:** Secure login functionality for accessing the application.
- **Configurable:** Easily generate configuration settings using a provided bash script.

## Uploading Your Own Notes

All uploaded notes must be stored in a zip format where the root directory contains a `README.md` file and an `images` directory containing any images used in the note. The `README.md` file should contain the content of the note in Markdown format.

An example structure is as follows:

```
note.zip:
├── README.md              # Markdown content of the note
└── images/                # Directory containing images used in the note
    ├── pic1.jpg
    ├── pic2.png
    └── ...
```

## Installation

1. **Clone the repository:**

   ```bash
   git clone https://github.com/dylanoonk/notetaker-i-hardly-know-er.git
   cd notetaker-i-hardly-know-er
   ```

2. **Run install script:**

   Use the provided bash script to install all dependencies and create a unique configuration file (which sets the username to `notetaker` and generates a unique password):

   ```bash
   chmod +x install.sh
   ./install.sh
   ```

   This will create a `config.json` file containing your configuration.

## Running the Application

1. **Start the server:**

   ```bash
   npm start
   ```

2. **Access the Application:**

    Open your browser and navigate to [http://localhost:3000](http://localhost:3000) (or the port you have configured).

## Project Structure

```
notetaker/
├── public/                  # Storage of images and posts
├── data/                    # Metadata for posts and images
├── views/                   # EJS templates for rendering pages
├── uploads/                 # Temporary storage for uploaded images
├── templates/               # Templates for new posts
├── install.sh               # Bash script to install the project
├── config.json              # Application configuration file (generated on install)
├── server.js                # Main application file
└── package.json             # Project metadata and dependencies (generated on install)
```

## Authentication

- **Login Page:** Visit `/login` to access the login page.
- **Default Credentials:**  
  - Username: `notetaker`  
  - Password: (generated in `config.json` using the bash script)

## Contributing

Contributions are welcome! Please fork the repository, make your changes, and submit a pull request. For major changes, please open an issue first to discuss what you would like to change.

## License

This project is licensed under the [MIT License](LICENSE).

## Acknowledgements

- Built using [Express](https://expressjs.com/), [EJS](https://ejs.co/), and [Bootstrap](https://getbootstrap.com/).
- Twemoji: Open source emoji library by Twitter (Used for favicon) ([License](https://github.com/twitter/twemoji/blob/master/LICENSE-GRAPHICS)).
- Inspired by the need for a simple yet powerful note-taking solution.
