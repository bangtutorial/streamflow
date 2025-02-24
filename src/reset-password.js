const readline = require('readline');
const database = require('./database');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function resetPassword() {
  console.log('\n=== StreamFlow Password Reset ===\n');
  let attempts = 0;
  const maxAttempts = 5;

  async function promptUsername() {
    try {
      const username = await new Promise(resolve => {
        rl.question('Username: ', answer => resolve(answer));
      });

      const user = await new Promise((resolve, reject) => {
        database.getUser(username, (err, user) => {
          if (err) reject(err);
          resolve(user);
        });
      });

      if (!user) {
        attempts++;
        if (attempts >= maxAttempts) {
          console.log(`\n❌ Gagal ${maxAttempts}x! Program akan ditutup.`);
          rl.close();
          return;
        }
        console.log(`\n❌ Username tidak ditemukan! (${attempts}/${maxAttempts})`);
        return await promptUsername();
      }
      return await handlePasswordReset(user);
    } catch (error) {
      console.error('\n❌ Terjadi kesalahan:', error.message);
      rl.close();
    }
  }

  async function handlePasswordReset(user) {
    try {
      async function promptPassword() {
        const password = await new Promise(resolve => {
          rl.question('Password baru: ', answer => resolve(answer));
        });

        if (password.length < 8) {
          console.log('\n❌ Password minimal 8 karakter!');
          return await promptPassword();
        }

        const confirmPassword = await new Promise(resolve => {
          rl.question('Ulangi password: ', answer => resolve(answer));
        });

        if (password !== confirmPassword) {
          console.log('\n❌ Password tidak sama!');
          return await promptPassword();
        }

        return password;
      }

      const validPassword = await promptPassword();
      const salt = crypto.randomBytes(16).toString('hex');
      const hashedPassword = crypto.createHash('sha256')
        .update(validPassword + salt)
        .digest('hex');

      await new Promise((resolve, reject) => {
        database.updateUser(user.id, {
          password_hash: hashedPassword,
          salt: salt
        }, (err) => {
          if (err) reject(err);
          resolve();
        });
      });

      console.log('\n✅ Password berhasil diubah!');
      rl.close();
    } catch (error) {
      console.error('\n❌ Terjadi kesalahan:', error.message);
      rl.close();
    }
  }

  await promptUsername();
}

resetPassword();