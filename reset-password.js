const readline = require('readline');
const bcrypt = require('bcrypt');
const { db } = require('./db/database');
const User = require('./models/User');
require('dotenv').config();
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});
function validatePassword(password) {
    const minLength = password.length >= 8;
    const hasLowercase = /[a-z]/.test(password);
    const hasUppercase = /[A-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const isValid = minLength && hasLowercase && hasUppercase && hasNumber;
    if (!isValid) {
        console.log('\nPassword requirements:');
        if (!minLength) console.log('- Must be at least 8 characters long');
        if (!hasLowercase) console.log('- Must contain at least one lowercase letter');
        if (!hasUppercase) console.log('- Must contain at least one uppercase letter');
        if (!hasNumber) console.log('- Must contain at least one number');
        console.log('');
    }
    return isValid;
}
function askUsername() {
    console.log('\n===== StreamFlow Lite - Password Reset =====\n');
    rl.question('Enter username: ', async (username) => {
        try {
            const user = await User.findByUsername(username);
            if (!user) {
                console.log('\n❌ User not found! Please check the username and try again.');
                askUsername();
                return;
            }
            console.log(`\n✅ User found: ${username}`);
            askNewPassword(user);
        } catch (error) {
            console.error('\n❌ Error finding user:', error);
            askUsername();
        }
    });
}
function askNewPassword(user) {
    rl.question('Enter new password: ', (password) => {
        if (!validatePassword(password)) {
            console.log('❌ Password does not meet requirements. Please try again.');
            askNewPassword(user);
            return;
        }
        askConfirmPassword(user, password);
    });
}
function askConfirmPassword(user, password) {
    rl.question('Confirm new password: ', async (confirmPassword) => {
        if (password !== confirmPassword) {
            console.log('\n❌ Passwords do not match! Please try again.');
            askConfirmPassword(user, password);
            return;
        }
        try {
            const hashedPassword = await bcrypt.hash(password, 10);
            await User.update(user.id, { password: hashedPassword });
            console.log('\n✅ Password has been reset successfully!\n');
            rl.close();
        } catch (error) {
            console.error('\n❌ Error resetting password:', error);
            console.log('Please try again.');
            askNewPassword(user);
        }
    });
}
askUsername();
rl.on('close', () => {
    console.log('\nPassword reset utility closed.');
    process.exit(0);
});