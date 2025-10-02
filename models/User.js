const { db, checkIfUsersExist } = require('../db/database');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
class User {
  static findByEmail(email) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM users WHERE email = ?', [email], (err, row) => {
        if (err) {
          return reject(err);
        }
        resolve(row);
      });
    });
  }
  static findByUsername(username) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM users WHERE username = ?', [username], (err, row) => {
        if (err) {
          return reject(err);
        }
        resolve(row);
      });
    });
  }
  static findById(id) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM users WHERE id = ?', [id], (err, row) => {
        if (err) {
          console.error('Database error in findById:', err);
          return reject(err);
        }
        resolve(row);
      });
    });
  }
  static async create(userData) {
    try {
      const hashedPassword = await bcrypt.hash(userData.password, 10);
      const userId = uuidv4();
      return new Promise((resolve, reject) => {
        db.run(
          'INSERT INTO users (id, username, password, avatar_path, user_role, status) VALUES (?, ?, ?, ?, ?, ?)',
          [userId, userData.username, hashedPassword, userData.avatar_path || null, userData.user_role || 'admin', userData.status || 'active'],
          function (err) {
            if (err) {
              console.error("DB error during user creation:", err);
              return reject(err);
            }
            console.log("User created successfully with ID:", userId);
            resolve({ id: userId, username: userData.username, user_role: userData.user_role || 'admin', status: userData.status || 'active' });
          }
        );
      });
    } catch (error) {
      console.error("Error in User.create:", error);
      throw error;
    }
  }
  static update(userId, userData) {
    const fields = [];
    const values = [];
    Object.entries(userData).forEach(([key, value]) => {
      fields.push(`${key} = ?`);
      values.push(value);
    });
    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(userId);
    const query = `UPDATE users SET ${fields.join(', ')} WHERE id = ?`;
    return new Promise((resolve, reject) => {
      db.run(query, values, function (err) {
        if (err) {
          return reject(err);
        }
        resolve({ id: userId, ...userData });
      });
    });
  }
  static async verifyPassword(plainPassword, hashedPassword) {
    return bcrypt.compare(plainPassword, hashedPassword);
  }

  static findAll() {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM users ORDER BY created_at DESC', [], (err, rows) => {
        if (err) {
          console.error('Database error in findAll:', err);
          return reject(err);
        }
        resolve(rows);
      });
    });
  }

  static updateStatus(userId, status) {
    return new Promise((resolve, reject) => {
      db.run(
        'UPDATE users SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [status, userId],
        function (err) {
          if (err) {
            console.error('Database error in updateStatus:', err);
            return reject(err);
          }
          resolve({ id: userId, status });
        }
      );
    });
  }

  static updateRole(userId, role) {
    return new Promise((resolve, reject) => {
      db.run(
        'UPDATE users SET user_role = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [role, userId],
        function (err) {
          if (err) {
            console.error('Database error in updateRole:', err);
            return reject(err);
          }
          resolve({ id: userId, user_role: role });
        }
      );
    });
  }

  static delete(userId) {
    return new Promise(async (resolve, reject) => {
      try {
        const Video = require('./Video');
        const Stream = require('./Stream');
        
        const userVideos = await Video.findAll(userId);
        const userStreams = await Stream.findAll(userId);
        
        for (const video of userVideos) {
          try {
            await Video.delete(video.id);
          } catch (videoDeleteError) {
            console.error(`Error deleting video ${video.id}:`, videoDeleteError);
          }
        }
        
        for (const stream of userStreams) {
          try {
            await Stream.delete(stream.id, userId);
          } catch (streamDeleteError) {
            console.error(`Error deleting stream ${stream.id}:`, streamDeleteError);
          }
        }
        
        db.run('DELETE FROM users WHERE id = ?', [userId], function (err) {
          if (err) {
            console.error('Database error in delete:', err);
            return reject(err);
          }
          resolve({ 
            id: userId, 
            deleted: true, 
            videosDeleted: userVideos.length,
            streamsDeleted: userStreams.length 
          });
        });
      } catch (error) {
        console.error('Error in user deletion process:', error);
        reject(error);
      }
    });
  }

  static updateProfile(userId, updateData) {
    return new Promise((resolve, reject) => {
      const fields = [];
      const values = [];
      
      if (updateData.username) {
        fields.push('username = ?');
        values.push(updateData.username);
      }
      
      if (updateData.user_role) {
        fields.push('user_role = ?');
        values.push(updateData.user_role);
      }
      
      if (updateData.status) {
        fields.push('status = ?');
        values.push(updateData.status);
      }
      
      if (updateData.avatar_path) {
        fields.push('avatar_path = ?');
        values.push(updateData.avatar_path);
      }
      
      if (updateData.password) {
        fields.push('password = ?');
        values.push(updateData.password);
      }
      
      if (fields.length === 0) {
        return resolve({ id: userId, message: 'No fields to update' });
      }
      
      fields.push('updated_at = CURRENT_TIMESTAMP');
      values.push(userId);
      
      const sql = `UPDATE users SET ${fields.join(', ')} WHERE id = ?`;
      
      db.run(sql, values, function (err) {
        if (err) {
          console.error('Database error in updateProfile:', err);
          return reject(err);
        }
        resolve({ id: userId, changes: this.changes });
      });
    });
  }
}
module.exports = User;