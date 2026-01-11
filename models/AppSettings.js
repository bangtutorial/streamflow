const { db } = require('../db/database');

class AppSettings {
  static get(key) {
    return new Promise((resolve, reject) => {
      db.get('SELECT setting_value FROM app_settings WHERE setting_key = ?', [key], (err, row) => {
        if (err) {
          console.error('Database error in AppSettings.get:', err);
          return reject(err);
        }
        resolve(row ? row.setting_value : null);
      });
    });
  }

  static set(key, value) {
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO app_settings (setting_key, setting_value, updated_at) 
         VALUES (?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(setting_key) DO UPDATE SET setting_value = ?, updated_at = CURRENT_TIMESTAMP`,
        [key, value, value],
        function(err) {
          if (err) {
            console.error('Database error in AppSettings.set:', err);
            return reject(err);
          }
          resolve({ key, value });
        }
      );
    });
  }

  static delete(key) {
    return new Promise((resolve, reject) => {
      db.run('DELETE FROM app_settings WHERE setting_key = ?', [key], function(err) {
        if (err) {
          console.error('Database error in AppSettings.delete:', err);
          return reject(err);
        }
        resolve({ deleted: this.changes > 0 });
      });
    });
  }

  static async getRecaptchaSettings() {
    const siteKey = await this.get('recaptcha_site_key');
    const secretKey = await this.get('recaptcha_secret_key');
    const enabled = await this.get('recaptcha_enabled');
    
    return {
      siteKey: siteKey || '',
      secretKey: secretKey || '',
      enabled: enabled === '1',
      hasKeys: !!(siteKey && secretKey)
    };
  }

  static async setRecaptchaSettings(siteKey, secretKey, enabled) {
    await this.set('recaptcha_site_key', siteKey);
    await this.set('recaptcha_secret_key', secretKey);
    await this.set('recaptcha_enabled', enabled ? '1' : '0');
  }

  static async deleteRecaptchaSettings() {
    await this.delete('recaptcha_site_key');
    await this.delete('recaptcha_secret_key');
    await this.delete('recaptcha_enabled');
  }
}

module.exports = AppSettings;
