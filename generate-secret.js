const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

function generateSecureSecret(length = 32) {
  return crypto.randomBytes(Math.ceil(length / 2)).toString('hex').slice(0, length);
}


function updateSessionSecret() {
  const envPath = path.join(__dirname, '.env');
  const newSecret = generateSecureSecret(32);
  
  try {
    let envContent = '';
    let oldSecret = null;
    
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf8');
      const match = envContent.match(/SESSION_SECRET=(.+)/);
      if (match) oldSecret = match[1].trim();
    }
    
    if (envContent && oldSecret) {
      envContent = envContent.replace(/SESSION_SECRET=.*/, `SESSION_SECRET=${newSecret}`);
    } else if (envContent) {
      envContent += `\nSESSION_SECRET=${newSecret}`;
    } else {
      envContent = `PORT=7575\nSESSION_SECRET=${newSecret}\n`;    }
      fs.writeFileSync(envPath, envContent, 'utf8');
    
    console.log(`Session secret: ${newSecret.substring(0, 8)}...${newSecret.substring(newSecret.length - 8)}`);
    
    return true;} catch (error) {
    console.error('Error updating session secret:', error.message);
    return false;
  }
}

updateSessionSecret();

module.exports = { generateSecureSecret, updateSessionSecret };
