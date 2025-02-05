========================================
             STREAMFLOW
========================================

##Deskripsi:
----------
StreamFlow is a simple live streaming application built with a Node.js backend and a plain HTML frontend.  It allows users to create and manage live streams, upload video previews, and control streaming parameters.

##Fitur Utama:
-------------
* **Live Streaming:**  Stream video content using RTMP.
* **User Authentication:** Secure user login and session management.
* **Stream Management:** Create, start, stop, and manage multiple streaming containers.
* **Video Previews:** Upload video previews for each stream.

##Teknologi yang digunakan:
-------------
* **Backend:** Node.js, Express.js, SQLite
* **Frontend:** Plain HTML, CSS, JavaScript
* **Streaming:** Fluent-ffmpeg
* **Other Libraries:** bcrypt, cors, express-session, multer, eventsource

##Prasyarat:
----------
Pastikan sistem Anda sudah terinstall:
* **Node.js (disarankan versi LTS)
* **npm (biasanya sudah terinstall bersama Node.js)
* **Git (opsional, untuk clone repository)

##Instalasi:
----------

Untuk Ubuntu / Unix:

1. Update Sistem:
   $ sudo apt update && sudo apt upgrade -y

2. Instal Node.js dan npm:

   - Menggunakan NodeSource (disarankan untuk mendapatkan versi LTS terbaru):
     $ curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
     $ sudo apt-get install -y nodejs

   - Atau menggunakan apt (pastikan versinya memadai):
     $ sudo apt install nodejs npm

3. Clone Repository:
   $ git clone https://github.com/bangtutorial/StreamFlow.git
   $ cd streamflow

4. Install Dependencies:
   $ npm install

5. Jalankan Aplikasi:
     $ npm start

6. Akses Aplikasi:
   Buka browser dan akses http://localhost:5000


Untuk Windows:

1. Instal Node.js dan npm:
   - Download installer Node.js dari https://nodejs.org/ dan ikuti petunjuk instalasinya.

2. Buka Command Prompt atau PowerShell.

3. Clone Repository:
   > git clone https://github.com/bangtutorial/StreamFlow.git
   > cd live-streaming-app

4. Install Dependencies:
   > npm install

5. Jalankan Aplikasi:
     > npm start

6. Akses Aplikasi:
   Buka browser dan akses http://localhost:5000

Konfigurasi Tambahan:
----------------------
Jika aplikasi memerlukan konfigurasi khusus (misalnya konfigurasi koneksi database, pengaturan port, dsb.), silakan periksa file konfigurasi di dalam folder "src" atau dokumentasi tambahan yang mungkin disediakan.

Kontribusi:
------------
Jika Anda ingin berkontribusi pada pengembangan aplikasi ini:
  1. Fork repository ini.
  2. Buat branch fitur baru (contoh: git checkout -b fitur-anda).
  3. Lakukan commit perubahan Anda (contoh: git commit -m "Menambahkan fitur ...").
  4. Push branch Anda (contoh: git push origin fitur-anda).
  5. Buat pull request.

Lisensi:
---------
Aplikasi ini dilisensikan di bawah MIT License.

========================================
