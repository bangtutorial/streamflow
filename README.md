# StreamFlow: Multi-Window Live Streaming Application

StreamFlow is a live streaming application that allows you to stream live to various platforms such as YouTube, Facebook, and others via the RTMP protocol. This application runs in a VPS (Virtual Private Server) environment and allows you to run multiple streams simultaneously by adding multiple streaming windows. StreamFlow also includes secure login features and streaming history to track your activity.

## Key Features:

* **Multi-Window Streaming:** Broadcast multiple streams simultaneously from a single application.
* **Versatile Platform Support:** Stream to YouTube, Facebook, and other platforms supporting RTMP.
* **User-Friendly Interface:** Easy to use and navigate, even for new users.
* **Secure Login:** Protect your account with a secure login system.
* **Streaming History:** Track all your streaming activity with a saved history.


## Installation:

**Before you begin:** You need to install Node.js, npm, and FFmpeg on your Ubuntu server before cloning the repository.

1. **Install Node.js and npm using the official NodeSource PPA:**

   ```bash
   curl -fsSL https://deb.nodesource.com/setup_16.x | sudo -E bash -
   sudo apt-get install -y nodejs
   sudo apt-get install -y npm
   ```
   Verify the installation:
   ```bash
   node -v
   npm -v
   ```

2. **Install FFmpeg:**

   ```bash
   sudo apt-get update
   sudo apt-get install -y ffmpeg
   ```
   Verify the installation:
   ```bash
   ffmpeg -version
   ```

3. **Clone the Repository:**
   ```bash
   git clone https://github.com/bangtutorial/StreamFlow/
   cd streamflow
   ```

4. **Install Dependencies:**
   Running `npm install` will automatically install all the necessary Node.js modules listed in the `package.json` file.  This includes packages like Express.js, SQLite3, bcryptjs, and others.

   ```bash
   npm install
   ```

5. **Run the Application:**
   ```bash
   npm start
   ```
   To run the application in development mode with auto-reload, use:
   ```bash
   npm run dev
   ```

6. **Configuration:**
    * Make sure you have configured the appropriate RTMP URL for each streaming platform you want to use. This configuration can be done through the application's user interface. You may need to obtain a Stream Key from your chosen streaming platform.

## Additional Information:

* This application uses Express.js as the backend framework, SQLite as the database, and FFmpeg for encoding and streaming.
* The user interface is built using HTML, CSS, and JavaScript with Tailwind CSS for styling.
* To run this application, ensure you have a server configured with Node.js and the required dependencies. This application is designed to run in a server environment, not a local browser.

## Contributing:

Contributions are highly appreciated! Please create a pull request if you have any improvements or new features.


## License:

MIT License

Copyright © 2025 <a href="https://youtube.com/bangtutorial">Bang Tutorial</a>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## Contact:

For questions or issues, please contact <info.bangtutorial@gmail.com>.
