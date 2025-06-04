const readline = require('readline');
const bcrypt = require('bcrypt');
const User = require('./models/User');
require('dotenv').config();
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});
function validatePassword(password) {
    const isValid = password && password.length > 0;
    
    if (!isValid) {
        console.log('\nPassword cannot be empty.\n');
        return false;
    }
    
    const minLength = password.length >= 8;
    const hasLowercase = /[a-z]/.test(password);
    const hasUppercase = /[A-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSymbol = /[^a-zA-Z0-9]/.test(password);
    
    let strengthScore = 0;
    if (minLength) strengthScore++;
    if (hasLowercase) strengthScore++;
    if (hasUppercase) strengthScore++;
    if (hasNumber) strengthScore++;
    if (hasSymbol) strengthScore++;
    
    console.log('\nPassword Strength Analysis:');
    if (strengthScore <= 1) {
        console.log('🔴 Very Weak - Consider making it stronger');
    } else if (strengthScore === 2) {
        console.log('🟡 Weak - Could be improved');
    } else if (strengthScore === 3) {
        console.log('🟠 Moderate - Getting better');
    } else if (strengthScore === 4) {
        console.log('🟢 Good - Nice password');
    } else {
        console.log('💚 Excellent - Very strong password');
    }
    
    console.log('\nPassword suggestions (optional):');
    if (!minLength) console.log('- Consider using at least 8 characters');
    if (!hasLowercase) console.log('- Consider adding lowercase letters');
    if (!hasUppercase) console.log('- Consider adding uppercase letters');
    if (!hasNumber) console.log('- Consider adding numbers');
    if (!hasSymbol) console.log('- Consider adding symbols (!@#$%^&*)');
    console.log('');
    
    return true;
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